import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-3.6-flash";

/**
 * Model cadangan, dicoba berurutan kalau model utama overload (503), kena
 * limit (429), error server (500/504), atau tidak merespons dalam batas
 * waktu. Kuota Gemini dihitung PER MODEL, jadi 429 di satu model tidak
 * berarti model lain ikut habis.
 *
 * Override lewat env var GEMINI_FALLBACK_MODELS (dipisah koma), mis.:
 *   GEMINI_FALLBACK_MODELS=gemini-3.5-flash,gemini-3.5-flash-lite
 */
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash,gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m.length > 0 && m !== GEMINI_MODEL);

export const MODEL_CHAIN: readonly string[] = [GEMINI_MODEL, ...FALLBACK_MODELS];

/**
 * Total waktu maksimal satu pemanggilan generateWithRetry (semua percobaan
 * dan semua model). WAJIB di bawah `maxDuration` route (60 detik) supaya
 * error terstruktur sempat dikembalikan dan hasil analisis yang satunya
 * (Promise.allSettled) tetap bisa dikirim ke user.
 */
const CALL_BUDGET_MS = Number(process.env.GEMINI_CALL_BUDGET_MS ?? 50_000);

/**
 * Batas satu percobaan selama masih ada model cadangan, supaya satu model
 * yang menggantung tidak menghabiskan seluruh budget. Model terakhir di
 * chain boleh memakai seluruh sisa budget.
 */
const ATTEMPT_CAP_WITH_FALLBACK_MS = Number(process.env.GEMINI_ATTEMPT_CAP_MS ?? 35_000);

const SAME_MODEL_RETRY_DELAY_MS = 1_500;
const SAME_MODEL_RETRIES = 1;

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Error terstandar untuk semua pemanggilan Gemini. `status` dipetakan dari
 * error asli Gemini API (429/400/403/404/503) atau kode custom (502/422/504)
 * untuk kegagalan non-HTTP (parse gagal, safety block, timeout). Endpoint
 * route.ts tinggal baca `.status` dan `.userMessage` buat bikin NextResponse
 * yang konsisten.
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

/** Dilempar internal saat satu percobaan melewati batas waktunya. */
class AttemptTimeoutError extends Error {
  constructor(ms: number) {
    super(`Percobaan Gemini melewati batas waktu ${ms}ms`);
    this.name = "AttemptTimeoutError";
  }
}

type GeneratePayload = Parameters<typeof ai.models.generateContent>[0];
type GenerateResponse = Awaited<ReturnType<typeof ai.models.generateContent>>;

function getStatus(e: unknown): number | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const { status, code } = e as { status?: unknown; code?: unknown };
  if (typeof status === "number") return status;
  if (typeof code === "number") return code;
  return undefined;
}

/**
 * Konversi error mentah (exception dari SDK @google/genai) jadi GeminiCallError
 * dengan pesan berbahasa Indonesia yang konsisten.
 */
export function toGeminiCallError(e: unknown, context: "bias" | "consistency"): GeminiCallError {
  if (e instanceof GeminiCallError) return e;

  const subject = context === "bias" ? "teks" : "dokumen";

  if (e instanceof AttemptTimeoutError) {
    return new GeminiCallError(
      504,
      "Analisis melewati batas waktu server. Coba lagi, atau gunakan dokumen yang lebih pendek.",
      e
    );
  }

  const status = getStatus(e);

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
  if (status === 503) {
    return new GeminiCallError(
      503,
      "Model Gemini sedang overload. Coba lagi dalam beberapa saat.",
      e
    );
  }
  if (status === 504) {
    return new GeminiCallError(504, "Gemini tidak merespons tepat waktu. Coba lagi.", e);
  }

  return new GeminiCallError(500, `Gagal menganalisis ${subject}. Coba lagi.`, e);
}

/** Error yang layak dicoba lagi di model yang sama (gangguan sesaat di sisi server). */
function isRetryableOnSameModel(status: number | undefined): boolean {
  return status === 503 || status === 500 || status === 504;
}

/**
 * Error yang layak dicoba di model cadangan. 400/403 (key/request salah)
 * sengaja TIDAK termasuk: model lain akan gagal dengan alasan yang sama.
 */
function isFallbackable(status: number | undefined, timedOut: boolean): boolean {
  if (timedOut) return true;
  return status === 503 || status === 500 || status === 504 || status === 429 || status === 404;
}

async function callOnce(
  payload: GeneratePayload,
  model: string,
  timeoutMs: number
): Promise<GenerateResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await ai.models.generateContent({
      ...payload,
      model,
      config: { ...payload.config, abortSignal: controller.signal },
    });
  } catch (e) {
    if (controller.signal.aborted) throw new AttemptTimeoutError(timeoutMs);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Wrap ai.models.generateContent dengan:
 *  1. Retry di model yang sama untuk gangguan sesaat (503/500/504), jeda tetap.
 *  2. Fallback ke model berikutnya di MODEL_CHAIN untuk 503/500/504/429/404
 *     dan timeout.
 *  3. Batas waktu total (CALL_BUDGET_MS) dan per percobaan, supaya satu
 *     panggilan yang menggantung tidak menghabiskan maxDuration route.
 *
 * Error 400/403 (konfigurasi salah) langsung dilempar tanpa retry/fallback.
 * Semua error keluar sebagai GeminiCallError. `payload.model` diabaikan,
 * model ditentukan oleh MODEL_CHAIN.
 */
export async function generateWithRetry(
  payload: GeneratePayload,
  context: "bias" | "consistency",
  retries: number = SAME_MODEL_RETRIES
): Promise<GenerateResponse> {
  const startedAt = Date.now();
  const remaining = () => CALL_BUDGET_MS - (Date.now() - startedAt);
  let lastError: unknown;

  for (let m = 0; m < MODEL_CHAIN.length; m++) {
    const model = MODEL_CHAIN[m];
    const hasFallback = m < MODEL_CHAIN.length - 1;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const left = remaining();
      if (left <= 0) {
        throw toGeminiCallError(lastError ?? new AttemptTimeoutError(CALL_BUDGET_MS), context);
      }
      const timeoutMs = hasFallback ? Math.min(left, ATTEMPT_CAP_WITH_FALLBACK_MS) : left;

      try {
        const response = await callOnce(payload, model, timeoutMs);
        if (m > 0 || attempt > 0) {
          console.info(`[${context}] berhasil dengan ${model} (model ke-${m + 1}, percobaan ke-${attempt + 1})`);
        }
        return response;
      } catch (e) {
        lastError = e;
        const status = getStatus(e);
        const timedOut = e instanceof AttemptTimeoutError;

        if (!isFallbackable(status, timedOut)) {
          throw toGeminiCallError(e, context);
        }

        const canRetrySame =
          !timedOut &&
          isRetryableOnSameModel(status) &&
          attempt < retries &&
          remaining() > SAME_MODEL_RETRY_DELAY_MS;

        if (canRetrySame) {
          console.warn(
            `[${context}] ${model} status ${status}, retry ke-${attempt + 1} setelah ${SAME_MODEL_RETRY_DELAY_MS}ms`
          );
          await sleep(SAME_MODEL_RETRY_DELAY_MS);
          continue;
        }

        console.warn(
          `[${context}] ${model} gagal (${timedOut ? "timeout" : `status ${status}`})` +
            (hasFallback ? `, pindah ke ${MODEL_CHAIN[m + 1]}` : ", tidak ada model cadangan tersisa")
        );
        break;
      }
    }
  }

  throw toGeminiCallError(lastError, context);
}