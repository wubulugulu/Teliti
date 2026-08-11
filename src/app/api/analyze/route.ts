import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Ganti ke "gemini-3.6-flash" kalau API key sudah punya akses ke model itu.
const GEMINI_MODEL = "gemini-3.6-flash";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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

interface GeminiApiError {
  status?: number;
  message?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = body?.text;

    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return NextResponse.json({ error: "Teks terlalu pendek" }, { status: 400 });
    }

    const safeText = truncateText(text.trim(), MAX_DOC_CHARS);

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Teks yang dianalisis:\n"""\n${safeText}\n"""`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });

    const candidate = response.candidates?.[0];

    if (!candidate) {
      console.error("Gemini tidak mengembalikan candidate:", JSON.stringify(response));
      return NextResponse.json(
        { error: "Gagal menganalisis teks. Coba lagi." },
        { status: 502 }
      );
    }

    const finishReason = candidate.finishReason;
    if (finishReason === "SAFETY" || finishReason === "PROHIBITED_CONTENT") {
      return NextResponse.json(
        {
          error:
            "Teks mengandung konten yang diblokir oleh filter keamanan Gemini. Coba periksa ulang isi teks.",
        },
        { status: 422 }
      );
    }

    if (finishReason === "MAX_TOKENS") {
      return NextResponse.json(
        { error: "Respons terlalu panjang untuk diproses. Coba dengan teks yang lebih pendek." },
        { status: 422 }
      );
    }

    const raw = response.text?.trim() ?? "";
    if (!raw) {
      console.error("Gemini mengembalikan teks kosong. finishReason:", finishReason);
      return NextResponse.json(
        { error: "Gagal menganalisis teks. Coba lagi." },
        { status: 502 }
      );
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
    console.error("Gemini analyze error:", e);

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

    return NextResponse.json({ error: "Gagal menganalisis teks. Coba lagi." }, { status: 500 });
  }
}