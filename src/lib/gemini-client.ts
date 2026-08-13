
import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-3.6-flash";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Error terstandar untuk semua pemanggilan Gemini. `status` dipetakan dari
 * error asli Gemini API (429/400/403/404) atau kode custom (502/422) untuk
 * kegagalan non-HTTP (parse gagal, safety block, dll). Endpoint route.ts
 * tinggal baca `.status` dan `.userMessage` buat bikin NextResponse yang
 * konsisten, tanpa duplikasi mapping error di setiap file.
 */
export class GeminiCallError extends Error {
  status: number;
  userMessage: string;

  constructor(status: number, userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "GeminiCallError";
    this.status = status;
    this.userMessage = userMessage;
    if (cause) this.cause = cause;
  }
}

interface RawGeminiApiError {
  status?: number;
  message?: string;
}

/**
 * Konversi error mentah (exception dari SDK @google/genai) jadi GeminiCallError
 * dengan pesan berbahasa Indonesia yang konsisten. Dipakai di catch block
 * setiap fungsi lib yang manggil Gemini.
 */
export function toGeminiCallError(e: unknown, context: "bias" | "consistency"): GeminiCallError {
  if (e instanceof GeminiCallError) return e;

  const err = e as RawGeminiApiError;
  const status = err?.status;
  const subject = context === "bias" ? "teks" : "dokumen";

  if (status === 429) {
    return new GeminiCallError(
      429,
      "Batas kuota Gemini API tercapai (rate limit). Tunggu sebentar lalu coba lagi.",
      e
    );
  }
  if (status === 400) {
    return new GeminiCallError(
      500,
      "Request ke Gemini tidak valid. Cek GEMINI_API_KEY di environment variable.",
      e
    );
  }
  if (status === 403) {
    return new GeminiCallError(
      500,
      "Akses ke Gemini API ditolak. Pastikan API key valid dan dibuat dari aistudio.google.com/apikey.",
      e
    );
  }
  if (status === 404) {
    return new GeminiCallError(
      500,
      `Model "${GEMINI_MODEL}" tidak ditemukan atau tidak tersedia untuk API key ini.`,
      e
    );
  }

  return new GeminiCallError(500, `Gagal menganalisis ${subject}. Coba lagi.`, e);
}