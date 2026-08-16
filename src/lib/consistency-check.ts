import { GEMINI_MODEL, GeminiCallError, generateWithRetry } from "./gemini-client";
import { MAX_DOC_CHARS } from "./constants";
import type { ConsistencyResult } from "@/components/ConsistencyResult";
import type { InlineImage } from "./pdf-extract";

const SYSTEM_PROMPT = `Kamu adalah reviewer akademik senior yang sangat teliti dan kritis. Tugasmu menganalisis dokumen penelitian/skripsi/paper secara MENDALAM dan KOMPREHENSIF.

Analisis SEMUA aspek berikut tanpa terkecuali:

## 1. KONSISTENSI LOGIS ANTAR BAB
- Apakah tujuan penelitian terjawab di hasil dan kesimpulan?
- Apakah rumusan masalah selaras dengan tujuan?
- Apakah metode yang digunakan sesuai untuk menjawab rumusan masalah?
- Apakah kesimpulan didukung oleh data hasil penelitian?
## 2. KONSISTENSI DATA & ANGKA
- Apakah angka/nilai yang disebutkan di Metode sama dengan di Hasil?
- Apakah jumlah sampel/responden konsisten di seluruh dokumen?
- Apakah nilai statistik (mean, std, score, dll) konsisten antar bagian?
- Apakah persentase dan proporsi yang disebutkan akurat dan konsisten?

## 3. KONSISTENSI VARIABEL & TERMINOLOGI
- Apakah nama variabel/istilah konsisten (tidak berganti nama di tengah dokumen)?
- Apakah definisi konsep di pendahuluan selaras dengan penggunaannya di metode/hasil?
- Apakah singkatan/akronim didefinisikan dan digunakan secara konsisten?

## 4. KONSISTENSI FIGURE & TABEL
- Apakah caption figure/tabel lengkap dan deskriptif?
- Apakah figure/tabel yang dirujuk di teks benar-benar ada?
- Apakah data dalam tabel konsisten dengan narasi teks?
- Apakah sumbu/label grafik sesuai dengan yang dijelaskan di teks?

## 5. KONSISTENSI METODOLOGI
- Apakah semua langkah metode yang dijelaskan benar-benar dilakukan (tercermin di hasil)?
- Apakah parameter/hyperparameter yang disebutkan di metode sesuai dengan yang digunakan?
- Apakah teknik evaluasi yang dipilih sesuai dengan jenis penelitian?
- Apakah batasan penelitian di pendahuluan konsisten dengan scope yang dikerjakan?

## 6. KONSISTENSI REFERENSI & KLAIM
- Apakah klaim yang dibuat didukung oleh data/referensi?
- Apakah ada klaim di kesimpulan yang tidak muncul di hasil?
- Apakah ada generalisasi berlebihan dari data yang terbatas?

## 7. KONSISTENSI PLATFORM & TOOLS
- Apakah tools/software yang disebutkan di metode konsisten dengan yang digunakan di hasil?
- Apakah dataset yang dijelaskan konsisten (sumber, ukuran, atribut)?

## 8. KELENGKAPAN STRUKTUR
- Apakah semua bagian standar paper ada (abstract, pendahuluan, metode, hasil, kesimpulan)?
- Apakah ada bagian yang tiba-tiba membahas topik di luar scope yang ditetapkan?

## ATURAN PENTING UNTUK section_a DAN section_b
Field "section_a" dan "section_b" HARUS merujuk pada bagian/bab yang BENAR-BENAR ADA di dokumen (ditandai heading eksplisit seperti "BAB I", "Bab III", atau nama section yang disebut literal di teks).

JANGAN membuat nama sub-bagian fiktif seperti "Abstrak (Metodologi)" atau "Abstrak (Kesimpulan)" jika dokumen yang diberikan hanya berupa satu paragraf/abstrak tanpa struktur bab eksplisit. Jika kontradiksi ditemukan DALAM satu paragraf yang sama (tidak ada pemisahan bab), gunakan section_a dan section_b yang IDENTIK, contoh: "Abstrak (Paragraf 1)" untuk keduanya — jangan memecahnya menjadi sub-bagian buatan.

Jika dokumen tidak memiliki struktur bab lengkap sama sekali, cukup laporkan SATU temuan kategori "Kelengkapan" yang menjelaskan hal ini, dan jangan memaksakan generate banyak pasangan section fiktif hanya untuk memenuhi kuota temuan.

Kembalikan HANYA JSON valid tanpa markdown:

{
  "sections": [
    {
      "name": "<nama bagian>",
      "summary": "<ringkasan isi bagian>"
    }
  ],
  "consistency_score": <0-100, KRITIS dalam menilai — jangan mudah kasih nilai tinggi>,
  "overall": "<penilaian umum 2-3 kalimat, jujur dan kritis, dalam bahasa Indonesia>",
  "issues": [
    {
      "title": "<judul singkat masalah>",
      "severity": "<low | medium | high>",
      "category": "<Konsistensi Logis | Data & Angka | Terminologi | Figure & Tabel | Metodologi | Referensi & Klaim | Platform & Tools | Kelengkapan>",
      "section_a": "<nama bagian pertama>",
      "section_b": "<nama bagian kedua>",
      "description": "<penjelasan detail inkonsistensi, sebutkan nilai/kalimat spesifik yang kontradiktif>",
      "suggestion": "<saran perbaikan konkret>"
    }
  ]
}

Aturan penilaian score yang KETAT:
- 90-100: Sempurna, hampir tidak ada inkonsistensi
- 75-89: Baik, inkonsistensi minor saja
- 60-74: Cukup, ada beberapa inkonsistensi yang perlu diperbaiki
- 40-59: Kurang, banyak inkonsistensi signifikan
- 20-39: Buruk, inkonsistensi serius di banyak bagian
- 0-19: Sangat buruk, dokumen tidak layak publikasi

Jangan ragu memberi skor rendah jika memang banyak masalah.
Sebutkan kalimat/angka SPESIFIK dari dokumen saat menjelaskan inkonsistensi.
Maksimal 10 temuan, prioritaskan yang paling kritis.
Selalu kembalikan JSON valid.`;

const MAX_IMAGES = 10;
const IMAGE_NOTE_MARKER = "[CATATAN OTOMATIS:";
const IMAGE_NOTE_RESERVED_CHARS = 2000;

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const markerIndex = text.indexOf(IMAGE_NOTE_MARKER);

  if (markerIndex === -1) {
    return (
      text.slice(0, maxChars) +
      "\n\n[...dokumen dipotong karena melebihi batas ukuran, analisis berdasarkan bagian di atas...]"
    );
  }

  const noteSection = text.slice(markerIndex);
  const bodyBudget = Math.max(maxChars - noteSection.length - IMAGE_NOTE_RESERVED_CHARS, 0);
  const bodySection = text.slice(0, Math.min(bodyBudget, markerIndex));

  return (
    bodySection +
    "\n\n[...dokumen dipotong karena melebihi batas ukuran...]\n\n" +
    noteSection
  );
}

/**
 * Jalankan cek konsistensi atas sebuah dokumen (teks + opsional gambar
 * halaman untuk verifikasi figure/chart via Gemini Vision). Melempar
 * GeminiCallError kalau gagal — sama seperti analyzeBias.
 *
 * Retry otomatis (exponential backoff) untuk error 503 (model overload)
 * ditangani di dalam generateWithRetry, sebelum error dikonversi jadi
 * GeminiCallError.
 */
export async function checkConsistency(
  text: string,
  images: InlineImage[] = []
): Promise<ConsistencyResult> {
  if (!text || typeof text !== "string" || text.trim().length < 50) {
    throw new GeminiCallError(400, "Teks terlalu pendek");
  }

  const safeText = truncateText(text.trim(), MAX_DOC_CHARS);

  const parts: Array<Record<string, unknown>> = [
    { text: `Dokumen yang dianalisis:\n"""\n${safeText}\n"""` },
  ];

  const validImages = images.filter((img) => img?.data && img?.mimeType).slice(0, MAX_IMAGES);

  for (const img of validImages) {
    parts.push({
      text: `Gambar berikut adalah halaman ${img.pageNumber} dari dokumen di atas (kemungkinan memuat figure dengan data numerik yang perlu diverifikasi):`,
    });
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const response = await generateWithRetry(
    {
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    },
    "consistency"
  );

  const candidate = response.candidates?.[0];
  if (!candidate) {
    console.error("Gemini (consistency) tidak mengembalikan candidate:", JSON.stringify(response));
    throw new GeminiCallError(502, "Gagal menganalisis dokumen.");
  }

  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
    throw new GeminiCallError(
      422,
      "Dokumen mengandung konten yang diblokir oleh filter keamanan Gemini. Coba periksa ulang isi dokumen."
    );
  }
  if (finishReason === "MAX_TOKENS") {
    throw new GeminiCallError(
      422,
      "Dokumen terlalu panjang untuk dianalisis sekaligus. Coba upload per-bab."
    );
  }

  const raw = response.text?.trim() ?? "";
  if (!raw) {
    console.error("Gemini (consistency) mengembalikan teks kosong. finishReason:", finishReason);
    throw new GeminiCallError(502, "Gagal menganalisis dokumen.");
  }

  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned) as ConsistencyResult;
  } catch {
    console.error("Gagal parse JSON dari Gemini (consistency):", raw);
    throw new GeminiCallError(502, "Gagal memproses hasil analisis dari AI.");
  }
}

export { GeminiCallError };