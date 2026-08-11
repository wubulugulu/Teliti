
import { ai, GEMINI_MODEL, GeminiCallError, toGeminiCallError } from "./gemini-client";
import type { BiasItem } from "@/app/page";

export interface AnalysisResult {
  score: number;
  summary: string;
  biases: BiasItem[];
}

const SYSTEM_PROMPT = `Kamu adalah AI spesialis deteksi bias dalam teks berbahasa Indonesia dan Inggris.

Kamu harus mendeteksi bias di 7 kategori berikut. Setiap kategori punya pola linguistik yang BEDA — jangan cuma fokus ke bias demografis yang eksplisit, tapi juga bias yang tersembunyi di reasoning/metodologi.

CONTOH TIAP KATEGORI (pelajari polanya, bukan cuma kata kuncinya):

1. Gender Bias — stereotip berdasarkan gender:
"Sebagai perempuan, dia terlalu emosional untuk jadi pemimpin proyek yang baik."
→ Kemampuan kepemimpinan dikaitkan ke stereotip gender, bukan kompetensi aktual.

2. Age Bias — stereotip berdasarkan usia:
"Orang di atas 50 tahun biasanya susah diajak kerja pakai teknologi baru, jadi lebih baik posisi ini diisi anak muda saja."
→ Generalisasi kemampuan teknis berdasarkan usia tanpa bukti individual.

3. Socioeconomic Bias — stereotip berdasarkan status ekonomi/kelas sosial:
"Karyawan yang berasal dari keluarga kurang mampu sering kali kurang punya etos kerja dibanding yang berasal dari keluarga mapan."
→ Etos kerja dikaitkan ke latar belakang ekonomi, bukan perilaku aktual individu.

4. Confirmation Bias — PENTING, pola ini BEDA dari yang lain karena bukan soal kelompok demografis, tapi soal REASONING/METODOLOGI yang cacat:
"Penelitian kami membuktikan bahwa hipotesis awal kami benar. Kami mengumpulkan data yang mendukung teori ini dan tidak menemukan hal yang bertentangan, karena memang dari awal kami yakin hasilnya akan seperti ini."
→ Kata kunci yang harus dicurigai: "membuktikan hipotesis awal", "yakin dari awal hasilnya akan seperti ini", "tidak mencari/tidak menemukan data yang bertentangan", "hanya mengambil data yang mendukung". Ini pola cherry-picking data atau penalaran melingkar (circular reasoning), BUKAN generalisasi tentang kelompok orang. Selalu cek apakah teks penelitian/analisis menunjukkan keterbukaan terhadap kemungkinan hasil berbeda, atau justru sudah "yakin" duluan sebelum data dikumpulkan.

5. Cultural Bias — menilai satu budaya lebih unggul dari budaya lain tanpa dasar objektif:
"Budaya kerja gesit ala startup Barat jauh lebih efektif dibanding budaya kerja yang lambat di kantor-kantor lokal."
→ Perbandingan budaya kerja yang menghakimi salah satu sebagai inferior tanpa data pembanding.

6. Racial Bias — stereotip berdasarkan ras/etnis:
"Karyawan keturunan Tionghoa memang lebih pelit dibanding karyawan pribumi."
→ Sifat personal (pelit) digeneralisasi ke seluruh kelompok etnis.

7. Ability Bias — stereotip berdasarkan disabilitas/kemampuan fisik-mental:
"Penyandang disabilitas biasanya tidak bisa diandalkan untuk pekerjaan yang membutuhkan kecepatan tinggi."
→ Kapasitas kerja digeneralisasi berdasarkan status disabilitas, bukan evaluasi individual.

8. Other — kategori bias lain yang gak masuk 6 di atas (agama, orientasi politik, orientasi seksual, dll):
"Orang yang beragama tertentu pasti lebih jujur dalam berbisnis dibanding yang lain."
→ Sifat personal (kejujuran) digeneralisasi berdasarkan afiliasi agama.

Analisis teks yang diberikan dan kembalikan HANYA JSON valid dengan format berikut, tanpa markdown, tanpa penjelasan tambahan:

{
  "score": <angka 0-100, makin tinggi makin banyak bias>,
  "summary": "<ringkasan singkat 1-2 kalimat tentang kondisi bias teks ini dalam bahasa Indonesia>",
  "biases": [
    {
      "sentence": "<kalimat atau frasa yang mengandung bias, kutip persis dari teks>",
      "type": "<salah satu: Gender Bias | Age Bias | Socioeconomic Bias | Confirmation Bias | Cultural Bias | Racial Bias | Ability Bias | Other>",
      "severity": "<low | medium | high>",
      "explanation": "<penjelasan singkat kenapa ini bias, dalam bahasa Indonesia>",
      "suggestion": "<saran kalimat pengganti yang lebih netral, dalam bahasa Indonesia>"
    }
  ]
}

Aturan:
- Jika tidak ada bias, kembalikan biases sebagai array kosong [] dan score antara 0-15
- Score 0-20: sangat bersih, 21-40: cukup bersih, 41-60: perlu perhatian, 61-80: banyak bias, 81-100: sangat bias
- Fokus pada bias yang nyata dan signifikan, bukan nitpicking berlebihan
- Untuk Confirmation Bias khususnya: cek apakah teks penelitian/analisis menunjukkan tanda cherry-picking data atau kesimpulan yang sudah ditentukan sebelum data dikumpulkan, meskipun teks tidak menyebut kelompok demografis apapun
- Maksimal 8 temuan bias
- Selalu kembalikan JSON valid`;

// Gemini free tier: 250.000 token/menit (jauh lebih longgar dari Groq 12.000 TPM),
// context window 1M token. Tetap dibatasi wajar untuk hindari biaya/latensi berlebihan.
const MAX_DOC_CHARS = 150000;

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return (
    text.slice(0, maxChars) +
    "\n\n[...teks dipotong karena melebihi batas ukuran, analisis berdasarkan bagian di atas...]"
  );
}

/**
 * Jalankan deteksi bias atas sebuah teks. Melempar GeminiCallError (dengan
 * `.status` & `.userMessage` siap pakai) kalau gagal di titik manapun —
 * caller (route.ts atau integrity-check) tinggal tangkap dan map ke response.
 */
export async function analyzeBias(text: string): Promise<AnalysisResult> {
  if (!text || typeof text !== "string" || text.trim().length < 10) {
    throw new GeminiCallError(400, "Teks terlalu pendek");
  }

  const safeText = truncateText(text.trim(), MAX_DOC_CHARS);

  let response;
  try {
    response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Teks yang dianalisis:\n"""\n${safeText}\n"""`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });
  } catch (e) {
    throw toGeminiCallError(e, "bias");
  }

  const candidate = response.candidates?.[0];
  if (!candidate) {
    console.error("Gemini (bias) tidak mengembalikan candidate:", JSON.stringify(response));
    throw new GeminiCallError(502, "Gagal menganalisis teks. Coba lagi.");
  }

  const finishReason = candidate.finishReason;
  if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
    throw new GeminiCallError(
      422,
      "Teks mengandung konten yang diblokir oleh filter keamanan Gemini. Coba periksa ulang isi teks."
    );
  }
  if (finishReason === "MAX_TOKENS") {
    throw new GeminiCallError(
      422,
      "Respons terlalu panjang untuk diproses. Coba dengan teks yang lebih pendek."
    );
  }

  const raw = response.text?.trim() ?? "";
  if (!raw) {
    console.error("Gemini (bias) mengembalikan teks kosong. finishReason:", finishReason);
    throw new GeminiCallError(502, "Gagal menganalisis teks. Coba lagi.");
  }

  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    return JSON.parse(cleaned) as AnalysisResult;
  } catch {
    console.error("Gagal parse JSON dari Gemini (bias):", raw);
    throw new GeminiCallError(502, "Gagal memproses hasil analisis dari AI.");
  }
}