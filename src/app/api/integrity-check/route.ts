
import { NextRequest, NextResponse } from "next/server";
import { analyzeBias, type AnalysisResult } from "@/lib/bias-analysis";
import { checkConsistency } from "@/lib/consistency-check";
import { GeminiCallError } from "@/lib/gemini-client";
import { extractPdf, PdfExtractError, type FigureReference, type InlineImage } from "@/lib/pdf-extract";
import type { ConsistencyResult } from "@/components/ConsistencyResult";

// Bobot Integrity Score. Consistency dibobot sama besar dengan bias karena
// keduanya sama-sama merepresentasikan "integritas" dokumen dari sisi
// berbeda (kejujuran metodologis vs netralitas penyajian). Diletakkan di
// satu tempat biar gampang di-tweak tanpa nyari-nyari di tengah logic.
const WEIGHTS = { bias: 0.5, consistency: 0.5 } as const;

interface IntegrityBreakdown {
  biasScore: number | null; // 0-100, makin tinggi makin banyak bias (raw dari analyzeBias)
  biasHealthScore: number | null; // 100 - biasScore, makin tinggi makin bersih
  consistencyScore: number | null; // 0-100, makin tinggi makin konsisten
  weights: typeof WEIGHTS;
}

interface IntegrityCheckResponse {
  integrityScore: number | null;
  breakdown: IntegrityBreakdown;
  biasResult: AnalysisResult | null;
  consistencyResult: ConsistencyResult | null;
  figures: FigureReference[];
  warnings: string[];
}

function scoreLabel(s: number): string {
  if (s >= 90) return "Sempurna";
  if (s >= 75) return "Baik";
  if (s >= 60) return "Cukup";
  if (s >= 40) return "Kurang";
  if (s >= 20) return "Buruk";
  return "Sangat Buruk";
}

/**
 * Ambil pesan+status paling informatif dari dua kemungkinan error, untuk
 * dipakai sebagai status HTTP response kalau KEDUA analisis gagal total.
 * Rate limit (429) diprioritaskan karena paling actionable buat user
 * ("tunggu sebentar") dibanding error generik.
 */
function pickWorstError(a: unknown, b: unknown): { status: number; message: string } {
  const errs = [a, b].filter((e): e is GeminiCallError => e instanceof GeminiCallError);
  const rateLimited = errs.find((e) => e.status === 429);
  if (rateLimited) return { status: 429, message: rateLimited.userMessage };
  if (errs[0]) return { status: errs[0].status, message: errs[0].userMessage };
  return { status: 500, message: "Gagal menganalisis dokumen." };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let text = "";
    let images: InlineImage[] = [];
    let figures: FigureReference[] = [];
    const warnings: string[] = [];

    if (contentType.includes("multipart/form-data")) {
      // Path PDF: ekstrak teks + gambar SEKALI, dipakai bareng oleh kedua analisis.
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      try {
        const extracted = await extractPdf(buffer);
        text = extracted.text;
        images = extracted.pageImages;
        figures = extracted.figures;
      } catch (e) {
        if (e instanceof PdfExtractError) {
          return NextResponse.json({ error: e.message }, { status: e.status });
        }
        throw e;
      }
    } else {
      // Path teks langsung / hasil ekstrak client-side (docx, txt).
      const body = await req.json();
      text = typeof body?.text === "string" ? body.text : "";
      images = Array.isArray(body?.images) ? body.images : [];
    }

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Dokumen terlalu pendek untuk dianalisis (minimal ~50 karakter)." },
        { status: 400 }
      );
    }

    // Jalankan dua analisis PARALEL — bukan berurutan — biar total waktu
    // tunggu ≈ analisis paling lambat, bukan jumlah keduanya. Pakai
    // allSettled (bukan Promise.all) supaya kalau salah satu gagal (mis.
    // kena rate limit Gemini), yang satunya tetap bisa ditampilkan alih-alih
    // membuat seluruh request gagal.
    const [biasSettled, consistencySettled] = await Promise.allSettled([
      analyzeBias(text),
      checkConsistency(text, images),
    ]);

    const biasResult = biasSettled.status === "fulfilled" ? biasSettled.value : null;
    const consistencyResult =
      consistencySettled.status === "fulfilled" ? consistencySettled.value : null;

    if (biasSettled.status === "rejected") {
      const err = biasSettled.reason;
      const msg = err instanceof GeminiCallError ? err.userMessage : "Gagal menganalisis bias.";
      warnings.push(`Analisis bias gagal: ${msg}`);
      console.error("integrity-check: analyzeBias gagal:", err);
    }
    if (consistencySettled.status === "rejected") {
      const err = consistencySettled.reason;
      const msg =
        err instanceof GeminiCallError ? err.userMessage : "Gagal menganalisis konsistensi.";
      warnings.push(`Analisis konsistensi gagal: ${msg}`);
      console.error("integrity-check: checkConsistency gagal:", err);
    }

    // Kalau DUA-duanya gagal, gak ada apapun buat ditampilkan — return error
    // sesungguhnya (bukan 200 kosong) dengan status paling informatif.
    if (!biasResult && !consistencyResult) {
      const { status, message } = pickWorstError(
        (biasSettled as PromiseRejectedResult).reason,
        (consistencySettled as PromiseRejectedResult).reason
      );
      return NextResponse.json({ error: message, warnings }, { status });
    }

    // Hitung Integrity Score. Kalau salah satu analisis gagal, score dihitung
    // dari yang berhasil saja (bobot penuh 1.0), bukan dianggap 0 — supaya
    // satu kegagalan gak menjatuhkan skor secara gak adil.
    const biasScore = biasResult ? biasResult.score : null;
    const biasHealthScore = biasScore !== null ? 100 - biasScore : null;
    const consistencyScore = consistencyResult ? consistencyResult.consistency_score : null;

    let integrityScore: number | null = null;
    if (biasHealthScore !== null && consistencyScore !== null) {
      integrityScore = Math.round(
        biasHealthScore * WEIGHTS.bias + consistencyScore * WEIGHTS.consistency
      );
    } else if (biasHealthScore !== null) {
      integrityScore = Math.round(biasHealthScore);
      warnings.push("Integrity Score dihitung hanya dari analisis bias (konsistensi tidak tersedia).");
    } else if (consistencyScore !== null) {
      integrityScore = Math.round(consistencyScore);
      warnings.push("Integrity Score dihitung hanya dari analisis konsistensi (bias tidak tersedia).");
    }

    const response: IntegrityCheckResponse = {
      integrityScore,
      breakdown: { biasScore, biasHealthScore, consistencyScore, weights: WEIGHTS },
      biasResult,
      consistencyResult,
      figures,
      warnings,
    };

    return NextResponse.json(response);
  } catch (e: unknown) {
    console.error("integrity-check error:", e);
    return NextResponse.json(
      { error: "Gagal menjalankan Integrity Check. Coba lagi." },
      { status: 500 }
    );
  }
}

export type { IntegrityCheckResponse, IntegrityBreakdown };
export { scoreLabel };