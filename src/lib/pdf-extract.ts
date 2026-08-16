import pdf from "pdf-parse/lib/pdf-parse.js";
import { createCanvas, Canvas, CanvasRenderingContext2D as NodeCanvasContext2D } from "canvas";
import path from "path";
import { pathToFileURL } from "url";

const DEFAULT_MAX_PAGES = 200;
const MAX_IMAGES_TO_SEND = 10;
const TARGET_MAX_IMAGE_DIMENSION = 1000;

export interface FigureReference {
  number: string;
  caption: string;
  pageNumber: number;
}

export interface InlineImage {
  pageNumber: number;
  mimeType: string;
  data: string; // base64, tanpa prefix "data:image/png;base64,"
}

interface PageTextEntry {
  pageNumber: number;
  text: string;
}
export interface PdfExtractResult {
  text: string;
  figures: FigureReference[];
  pageImages: InlineImage[];
  totalPagesInDocument: number; // total halaman PDF asli, dari metadata pdf-parse
  pagesScanned: number; // jumlah halaman yang benar-benar diekstrak (<= maxPages)
}

// pdf-parse (v1.1.1) memanggil callback ini sekali per halaman, urut dari
// halaman 1. Kita pakai counter closure (bukan pageData.pageIndex) karena
// pdf-parse membungkus versi pdfjs internal sendiri yang API persisnya
// gak selalu konsisten antar versi — counter jauh lebih pasti.
function buildPageRenderer(pageTexts: PageTextEntry[]) {
  let currentPage = 0;

  return function renderPage(pageData: any): Promise<string> {
    currentPage += 1;
    const pageNumber = currentPage;

    const renderOptions = {
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    };

    return pageData.getTextContent(renderOptions).then((textContent: any) => {
      let lastY: number | undefined;
      let text = "";

      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === undefined) {
          text += item.str;
        } else {
          text += "\n" + item.str;
        }
        lastY = item.transform[5];
      }

      pageTexts.push({ pageNumber, text });
      return text;
    });
  };
}

function extractFigureReferences(pageTexts: PageTextEntry[]): FigureReference[] {
  const seen = new Set<string>();
  const figures: FigureReference[] = [];

  for (const { pageNumber, text } of pageTexts) {
    const pattern = /(?:Figure|Fig\.?|Gambar)\s+(\d+)[.:]?\s*([^\n]{0,150})/gi;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const number = match[1];
      if (seen.has(number)) continue;
      seen.add(number);
      figures.push({ number, caption: match[2].trim(), pageNumber });
    }
  }

  return figures;
}

// Custom canvas factory — WAJIB di-supply eksplisit ke getDocument().
// Ini fix untuk bug lama "TypeError: Image or Canvas expected": pdfjs-dist
// punya canvas factory bawaan yang coba auto-detect modul 'canvas' secara
// internal, tapi auto-detection itu gagal di bawah webpack bundling
// Next.js dan menghasilkan objek canvas yang gak valid. Dengan supply
// factory sendiri yang langsung panggil createCanvas() dari package
// 'canvas', kita bypass seluruh auto-detection yang bermasalah itu.
class NodeCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    return { canvas, context };
  }

  reset(
    canvasAndContext: { canvas: Canvas; context: NodeCanvasContext2D },
    width: number,
    height: number
  ) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: {
    canvas: Canvas | null;
    context: NodeCanvasContext2D | null;
  }) {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function renderPagesToImages(
  buffer: Buffer,
  pageNumbers: number[]
): Promise<InlineImage[]> {
  if (pageNumbers.length === 0) return [];
  // @ts-ignore
  const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
  // Fix module resolution worker (bug lama: Next.js webpack gak bundle
  // pdf.worker.mjs dengan benar di vendor-chunks). Set manual pakai
  // absolute filesystem path, bypass webpack resolution sepenuhnya.
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.mjs"
  );
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const { Image } = await import("canvas");
  (global as any).Image = Image;
  const canvasFactory = new NodeCanvasFactory();

  const loadingTask = (pdfjsLib as any).getDocument({
    data: new Uint8Array(buffer),
    canvasFactory,
  });
  const pdfDoc = await loadingTask.promise;
  const images: InlineImage[] = [];

  for (const pageNumber of pageNumbers) {
    if (pageNumber > pdfDoc.numPages) continue;

    const page = await pdfDoc.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const maxDim = Math.max(baseViewport.width, baseViewport.height);
    const scale =
      maxDim > TARGET_MAX_IMAGE_DIMENSION ? TARGET_MAX_IMAGE_DIMENSION / maxDim : 1;
    const viewport = page.getViewport({ scale });

    const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);

    const renderTask = (page as any).render({
      canvasContext: canvasAndContext.context,
      viewport,
      canvasFactory,
    });

    await renderTask.promise;

    const pngBuffer = (canvasAndContext.canvas as Canvas).toBuffer("image/png");
    images.push({
      pageNumber,
      mimeType: "image/png",
      data: pngBuffer.toString("base64"),
    });

    canvasFactory.destroy(canvasAndContext as any);
  }

  return images;
}

/**
 * Custom error untuk kegagalan ekstraksi PDF, supaya caller (route.ts atau
 * integrity-check) bisa bedain "PDF gagal dibaca" (400/422, salah user)
 * dari error server (500).
 */
export class PdfExtractError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PdfExtractError";
    this.status = status;
  }
}

/**
 * Ekstrak teks + render halaman yang memuat figure jadi gambar (untuk
 * verifikasi visual via Gemini Vision). Dipakai bareng oleh
 * /api/extract-pdf (standalone) dan /api/integrity-check (orkestrasi).
 *
 * `maxPages` opsional, default MAX_CHECK_PAGES — dipakai route.ts untuk
 * adaptive page limiting berdasarkan ukuran file (file besar = scan lebih
 * sedikit halaman, biar gak timeout).
 */
export async function extractPdf(
  buffer: Buffer,
  maxPages: number = DEFAULT_MAX_PAGES
): Promise<PdfExtractResult> {  
  const pageTexts: PageTextEntry[] = [];
  const data = await pdf(buffer, {
    pagerender: buildPageRenderer(pageTexts),
    max: maxPages,
  });
  const layerText = data.text?.trim() ?? "";

  if (!layerText) {
    throw new PdfExtractError(422, "Teks kosong, PDF mungkin tidak bisa dibaca sama sekali.");
  }

  const figures = extractFigureReferences(pageTexts);

  const uniquePageNumbers = Array.from(new Set(figures.map((f) => f.pageNumber)))
    .sort((a, b) => a - b)
    .slice(0, MAX_IMAGES_TO_SEND);

  const IS_VERCEL = !!process.env.VERCEL;
  let pageImages: InlineImage[] = [];
  if (!IS_VERCEL) {
    try {
      pageImages = await renderPagesToImages(buffer, uniquePageNumbers);
    } catch (renderErr) {
      console.warn("Render halaman ke gambar gagal, lanjut tanpa gambar:", renderErr);
    }
  }

  let finalText = layerText;
  if (figures.length > 0) {
    const figureList = figures
      .map(
        (f) =>
          `Figure ${f.number} (halaman ${f.pageNumber})${f.caption ? `: "${f.caption}"` : ""}`
      )
      .join("; ");

    const imageNote =
      pageImages.length > 0
        ? `${pageImages.length} halaman yang memuat figure disertakan sebagai gambar untuk verifikasi visual oleh AI.`
        : `Gambar tidak berhasil disertakan (rendering gagal di server), verifikasi visual tidak tersedia untuk analisis ini — hanya caption yang terbaca.`;

    finalText += `\n\n[CATATAN OTOMATIS: Dokumen ini mereferensikan ${figures.length} figure (${figureList}). Figure biasanya berupa gambar/chart hasil eksperimen (raster image). ${imageNote}]`;
  }

return {
    text: finalText.trim(),
    figures,
    pageImages,
    totalPagesInDocument: data.numpages ?? pageTexts.length,
    pagesScanned: pageTexts.length,
  };
}