import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const GEMINI_MODEL = "gemini-3.6-flash";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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

const MAX_DOC_CHARS = 150000;
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

interface InlineImage {
  pageNumber: number;
  mimeType: string;
  data: string;
}

interface GeminiApiError {
  status?: number;
  message?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body?.text;
    const images: InlineImage[] = Array.isArray(body?.images) ? body.images : [];

    if (!text || typeof text !== "string" || text.trim().length < 50) {
      return NextResponse.json({ error: "Teks terlalu pendek" }, { status: 400 });
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

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const candidate = response.candidates?.[0];

    if (!candidate) {
      console.error("Gemini tidak mengembalikan candidate:", JSON.stringify(response));
      return NextResponse.json({ error: "Gagal menganalisis dokumen." }, { status: 502 });
    }

    const finishReason = candidate.finishReason;
    if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
      return NextResponse.json(
        {
          error:
            "Dokumen mengandung konten yang diblokir oleh filter keamanan Gemini. Coba periksa ulang isi dokumen.",
        },
        { status: 422 }
      );
    }

    if (finishReason === "MAX_TOKENS") {
      return NextResponse.json(
        { error: "Dokumen terlalu panjang untuk dianalisis sekaligus. Coba upload per-bab." },
        { status: 422 }
      );
    }

    const raw = response.text?.trim() ?? "";
    if (!raw) {
      console.error("Gemini mengembalikan teks kosong. finishReason:", finishReason);
      return NextResponse.json({ error: "Gagal menganalisis dokumen." }, { status: 502 });
    }

    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Gagal parse JSON dari Gemini:", raw);
      return NextResponse.json(
        { error: "Gagal memproses hasil analisis dari AI." },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (e: unknown) {
    console.error("Gemini consistency-check error:", e);

    const err = e as GeminiApiError;
    const status = err?.status;

    if (status === 429) {
      return NextResponse.json(
        { error: "Batas kuota Gemini API tercapai (rate limit). Tunggu sebentar lalu coba lagi." },
        { status: 429 }
      );
    }

    if (status === 400) {
      return NextResponse.json(
        { error: "Request ke Gemini tidak valid. Cek GEMINI_API_KEY di environment variable." },
        { status: 500 }
      );
    }

    if (status === 403) {
      return NextResponse.json(
        {
          error:
            "Akses ke Gemini API ditolak. Pastikan API key valid dan dibuat dari aistudio.google.com/apikey.",
        },
        { status: 500 }
      );
    }

    if (status === 404) {
      return NextResponse.json(
        { error: `Model "${GEMINI_MODEL}" tidak ditemukan atau tidak tersedia untuk API key ini.` },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: "Gagal menganalisis dokumen." }, { status: 500 });
  }
}