import { ai, GEMINI_MODEL, toGeminiCallError, GeminiCallError } from "./gemini-client";
import type { BiasItem } from "@/types";

export interface RewriteResult {
  revisedText: string;
  changeCount: number;
}

const SYSTEM_PROMPT = `Kamu adalah editor profesional yang menulis ulang dokumen akademik/penelitian berbahasa Indonesia untuk menghilangkan bias dan inkonsistensi, TANPA mengubah makna, struktur, atau informasi faktual yang sah.

Kamu akan menerima:
1. Teks dokumen asli
2. Daftar temuan bias (kalimat bermasalah + saran perbaikan)
3. Daftar temuan inkonsistensi (jika ada)

Tugasmu:
- Ganti HANYA kalimat/frasa yang disebut dalam temuan, pakai saran yang diberikan sebagai acuan (boleh disesuaikan redaksinya biar nyambung secara alami dengan kalimat sekitarnya)
- JANGAN mengubah bagian teks yang tidak disebut dalam temuan
- JANGAN menambah atau menghapus informasi/data/angka yang tidak terkait temuan
- Pertahankan struktur paragraf dan urutan aslinya
- Pertahankan bahasa asli dokumen (Indonesia tetap Indonesia, Inggris tetap Inggris)

Kembalikan HANYA JSON valid, tanpa markdown, tanpa penjelasan tambahan:

{
  "revisedText": "<seluruh teks dokumen setelah direvisi, lengkap dari awal sampai akhir>",
  "changeCount": <jumlah kalimat yang benar-benar diubah>
}`;

const MAX_DOC_CHARS = 100000;

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[...dipotong...]";
}

export async function rewriteDocument(
  text: string,
  biases: BiasItem[],
  issues: any[]
): Promise<RewriteResult> {
  if (!text || text.trim().length < 10) {
    throw new GeminiCallError(400, "Teks terlalu pendek");
  }
  if (biases.length === 0 && issues.length === 0) {
    return { revisedText: text, changeCount: 0 };
  }

  const safeText = truncateText(text.trim(), MAX_DOC_CHARS);

  const findingsBlock = [
    ...biases.map(
      (b, i) =>
        `Bias #${i + 1} (${b.type}, ${b.severity}):\nKalimat asli: "${b.sentence}"\nSaran: "${b.suggestion}"`
    ),
    ...issues.map(
      (iss: any, i: number) =>
        `Inkonsistensi #${i + 1} (${iss.category ?? "umum"}):\n${iss.title ?? ""}\nSaran: "${iss.suggestion ?? ""}"`
    ),
  ].join("\n\n");

  let response;
  try {
    response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Teks dokumen asli:\n"""\n${safeText}\n"""\n\nDaftar temuan yang harus diperbaiki:\n"""\n${findingsBlock}\n"""`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });
  } catch (e) {
    throw toGeminiCallError(e, "bias");
  }

  const raw = response.text?.trim() ?? "";
  console.log("RAW GEMINI REWRITE:", raw.slice(0, 500)); // tambah ini
  if (!raw) {
    throw new GeminiCallError(502, "Gagal membuat dokumen revisi. Coba lagi.");
  }

  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned) as RewriteResult;
  } catch {
    console.error("Gagal parse JSON dari Gemini (rewrite):", raw);
    throw new GeminiCallError(502, "Gagal memproses hasil revisi dari AI.");
  }
}