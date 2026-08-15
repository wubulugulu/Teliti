// src/app/api/integrity-check/route.ts

import { NextRequest, NextResponse } from "next/server";
import { analyzeBias } from "@/lib/bias-analysis";
import { checkConsistency } from "@/lib/consistency-check";
import { extractPdf, PdfExtractError } from "@/lib/pdf-extract";
import type { InlineImage } from "@/lib/pdf-extract";
import { GeminiCallError } from "@/lib/gemini-client";

export const maxDuration = 60; // Vercel Hobby plan cap

const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB
const PDF_EXTRACTION_TIMEOUT_MS = 40_000; // sisakan ~20s untuk Gemini call
const MAX_DOC_CHARS = 150_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout setelah ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Kurangi jumlah halaman yang di-scan kalau file besar.
 * Dokumen besar biasanya juga berat per halaman (banyak gambar/vector),
 * jadi scan penuh 60 halaman bisa jauh lebih lambat dari perkiraan.
 */
function getAdaptiveMaxPages(fileSizeBytes: number): number {
  const sizeMB = fileSizeBytes / (1024 * 1024);
  if (sizeMB > 3) return 25;
  if (sizeMB > 1.5) return 40;
  return 60;
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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const manualText = formData.get("text") as string | null;

    let documentText: string;
    let pageImages: InlineImage[] = [];

    if (file) {
      // --- 1. Validasi ukuran file SEBELUM proses apapun ---
      if (file.size > MAX_FILE_SIZE_BYTES) {
        console.timeEnd("total-request");
        return NextResponse.json(
          { error: "Ukuran file maksimal 4MB." },
          { status: 413 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const maxPages = getAdaptiveMaxPages(file.size);

      // --- 2. Ekstraksi PDF dengan timeout guard ---
      console.time("pdf-extract");
      let extracted;
      try {
        extracted = await withTimeout(
          extractPdf(buffer, maxPages),
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
    } else if (manualText) {
      documentText = manualText;
      // pageImages tetap [] — input teks manual, gak ada PDF buat di-render
    } else {
      console.timeEnd("total-request");
      return NextResponse.json(
        { error: "Tidak ada file atau teks yang dikirim." },
        { status: 400 }
      );
    }

    // --- 3. Truncate biar aman dari limit token/TPM Gemini ---
    const truncatedText = documentText.slice(0, MAX_DOC_CHARS);

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
      // batasi payload balik ke client biar ga kena 413 lagi
      documentText: truncatedText.slice(0, 100_000),
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