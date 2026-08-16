// src/app/api/integrity-check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { analyzeBias } from "@/lib/bias-analysis";
import { checkConsistency } from "@/lib/consistency-check";
import { extractPdf, PdfExtractError } from "@/lib/pdf-extract";
import type { InlineImage } from "@/lib/pdf-extract";
import { GeminiCallError } from "@/lib/gemini-client";
import { MAX_DOC_CHARS, MAX_FILE_SIZE_BYTES } from "@/lib/constants";

export const maxDuration = 60; // Vercel Hobby plan cap

const MAX_EXTRACT_PAGES = 200; // ceiling ekstraksi -- lihat komentar di pdf-extract.ts
const PDF_EXTRACTION_TIMEOUT_MS = 15_000; // ekstraksi murni teks biasanya <3s, ini jaring pengaman

// ---------------------------------------------------------------------------
// CATATAN TUNING: lihat src/lib/constants.ts untuk log data timing dan
// alasan nilai MAX_DOC_CHARS saat ini. Proses tuning:
//   1. Deploy, jalanin scan dokumen panjang (100+ halaman)
//   2. Cek Vercel log "gemini-parallel", "total-request", dan baris
//      "Document coverage:" (log baru di bawah)
//   3. Kalau masih ada margin aman ke 60 detik (misal < 48s), naikin
//      MAX_DOC_CHARS di constants.ts, update TUNING LOG di sana, deploy
//      lagi, ulangi cek log
//   4. Begitu gemini-parallel mendekati ~48-50s, STOP -- itu batas
//      amannya. Dokumentasikan angka final ini di FAQ produk.
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout setelah ${ms}ms`)), ms)
    ),
  ]);
}

interface DocumentCoverage {
  totalPagesInDocument: number | null;
  pagesScanned: number | null;
  totalChars: number;
  analyzedChars: number;
  truncated: boolean;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------
//
// NOTE: retry-on-503 untuk Gemini SUDAH ditangani di dalam
// generateWithRetry (gemini-client.ts), yang dipanggil oleh analyzeBias
// dan checkConsistency. Jangan wrap pemanggilannya dengan retry lagi di
// sini — kalau overload menetap, itu jadi retry bersarang (retries+1)^2
// percobaan nyata ke Gemini, yang bisa menghabiskan sisa budget waktu
// sebelum maxDuration (60s) tercapai dan malah bikin request gagal total
// alih-alih retry membantu.

export async function POST(req: NextRequest) {
  console.time("total-request");

  try {
    // Content-Type request BEDA tergantung jalur pengiriman dari client:
    //   - Upload PDF (page.tsx, jalur file?.name.endsWith(".pdf")) ->
    //     FormData -> "multipart/form-data"
    //   - Paste teks manual ATAU docx/txt (diekstrak ke teks di client
    //     lewat mammoth sebelum dikirim) -> JSON.stringify -> "application/json"
    // req.formData() cuma bisa parse "multipart/form-data" atau
    // "application/x-www-form-urlencoded" -- manggil itu langsung tanpa
    // cek Content-Type dulu bikin crash TypeError mentah dari Node buat
    // request JSON. Makanya harus di-branch di sini.
    const contentType = req.headers.get("content-type") ?? "";

    let file: File | null = null;
    let manualText: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      file = formData.get("file") as File | null;
      manualText = formData.get("text") as string | null;
    } else if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      if (!body || typeof body.text !== "string") {
        console.timeEnd("total-request");
        return NextResponse.json(
          { error: "Body JSON harus berisi field 'text' bertipe string." },
          { status: 400 }
        );
      }
      manualText = body.text;
    } else {
      console.timeEnd("total-request");
      return NextResponse.json(
        {
          error:
            "Content-Type tidak didukung. Gunakan 'multipart/form-data' untuk upload file atau 'application/json' untuk teks langsung.",
        },
        { status: 415 }
      );
    }

    let documentText: string;
    let pageImages: InlineImage[] = [];
    let documentCoverage: DocumentCoverage;

    if (file) {
      // --- 1. Validasi ukuran file SEBELUM proses apapun ---
      if (file.size > MAX_FILE_SIZE_BYTES) {
        console.timeEnd("total-request");
        return NextResponse.json(
          { error: `Ukuran file maksimal ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(1)}MB.` },
          { status: 413 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // --- 2. Ekstraksi PDF dengan timeout guard ---
      console.time("pdf-extract");
      let extracted;
      try {
        extracted = await withTimeout(
          extractPdf(buffer, MAX_EXTRACT_PAGES),
          PDF_EXTRACTION_TIMEOUT_MS,
          "Ekstraksi PDF"
        );
      } catch (err) {
        console.timeEnd("pdf-extract");
        console.timeEnd("total-request");
        console.error("PDF extraction gagal atau timeout:", err);

        // PdfExtractError punya status yang sudah dipetakan (422 = teks
        // kosong / PDF tidak terbaca). Error lain di titik ini adalah
        // timeout dari withTimeout, atau kegagalan tak terduga -> 408.
        if (err instanceof PdfExtractError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }

        return NextResponse.json(
          {
            error:
              "Dokumen terlalu besar/kompleks untuk diproses dalam batas waktu. " +
              "Coba pecah dokumen jadi bagian lebih kecil, atau kurangi jumlah halaman.",
          },
          { status: 408 }
        );
      }
      console.timeEnd("pdf-extract");

      documentText = extracted.text;
      pageImages = extracted.pageImages;
      documentCoverage = {
        totalPagesInDocument: extracted.totalPagesInDocument,
        pagesScanned: extracted.pagesScanned,
        totalChars: documentText.length,
        analyzedChars: 0, // diisi setelah truncate di bawah
        truncated: false,
      };
    } else if (manualText) {
      documentText = manualText;
      // pageImages tetap [] — input teks manual, gak ada PDF buat di-render
      documentCoverage = {
        totalPagesInDocument: null,
        pagesScanned: null,
        totalChars: documentText.length,
        analyzedChars: 0,
        truncated: false,
      };
    } else {
      console.timeEnd("total-request");
      return NextResponse.json(
        { error: "Tidak ada file atau teks yang dikirim." },
        { status: 400 }
      );
    }

    // --- 3. Truncate biar aman dari limit token/TPM Gemini ---
    const truncatedText = documentText.slice(0, MAX_DOC_CHARS);
    documentCoverage.analyzedChars = truncatedText.length;
    documentCoverage.truncated = documentText.length > MAX_DOC_CHARS;

    // Log langsung di server, biar keliatan di Vercel log tanpa perlu buka
    // Network tab -- ini yang bakal nunjukkin persis kenapa hasil analisis
    // berhenti di bab tertentu (kena cap halaman ekstraksi, atau kena cap
    // MAX_DOC_CHARS).
    console.log("Document coverage:", JSON.stringify(documentCoverage));

    // --- 4. Jalankan bias + consistency check paralel. ---
    // Retry sudah di-handle di dalam analyzeBias/checkConsistency
    // (lewat generateWithRetry) -- lihat catatan di atas.
    // checkConsistency dapat pageImages buat verifikasi visual figure via
    // Gemini Vision; analyzeBias tidak butuh gambar.
    console.time("gemini-parallel");
    const [biasResult, consistencyResult] = await Promise.allSettled([
      analyzeBias(truncatedText),
      checkConsistency(truncatedText, pageImages),
    ]);
    console.timeEnd("gemini-parallel");

    // --- 5. Hitung Integrity Score, toleran kalau salah satu gagal ---
    const biasScore =
      biasResult.status === "fulfilled" ? biasResult.value.score : null;
    const consistencyScore =
      consistencyResult.status === "fulfilled"
        ? consistencyResult.value.consistency_score
        : null;

    if (biasScore === null && consistencyScore === null) {
      console.timeEnd("total-request");
      return NextResponse.json(
        { error: "Analisis gagal total. Coba lagi beberapa saat." },
        { status: 502 }
      );
    }

    let integrityScore: number;
    if (biasScore !== null && consistencyScore !== null) {
      integrityScore = Math.round((100 - biasScore) * 0.5 + consistencyScore * 0.5);
    } else if (biasScore !== null) {
      integrityScore = Math.round(100 - biasScore);
    } else {
      integrityScore = Math.round(consistencyScore as number);
    }

    console.timeEnd("total-request");

    return NextResponse.json({
      integrityScore,
      bias:
        biasResult.status === "fulfilled"
          ? biasResult.value
          : { error: "Bias analysis gagal", detail: String(biasResult.reason) },
      consistency:
        consistencyResult.status === "fulfilled"
          ? consistencyResult.value
          : {
              error: "Consistency check gagal",
              detail: String(consistencyResult.reason),
            },
      documentCoverage,
      // batasi payload balik ke client biar ga kena 413 lagi
      documentText: truncatedText,
    });
  } catch (err) {
    console.timeEnd("total-request");
    console.error("integrity-check fatal error:", err);

    // analyzeBias/checkConsistency sudah mengonversi error mereka sendiri
    // jadi GeminiCallError sebelum dilempar (lihat gemini-client.ts).
    // Error lain di titik ini (formData parsing, JSON serialization, dll)
    // bukan tanggung jawab Gemini, jadi cukup dipetakan generik.
    if (err instanceof GeminiCallError) {
      return NextResponse.json({ error: err.userMessage }, { status: err.status });
    }

    return NextResponse.json(
      { error: "Terjadi kesalahan pada server. Coba lagi." },
      { status: 500 }
    );
  }
}