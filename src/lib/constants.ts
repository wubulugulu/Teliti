/**
 * Batas jumlah karakter dokumen yang dikirim ke Gemini per panggilan.
 *
 * WAJIB satu-satunya sumber angka ini -- dipakai di route.ts (buat
 * truncate + hitung documentCoverage) dan juga di bias-analysis.ts /
 * consistency-check.ts (truncate independen sebagai defense-in-depth,
 * kalau-kalau salah satu fungsi itu dipanggil langsung tanpa lewat
 * route.ts, misal dari endpoint lain di masa depan). JUGA dipakai di
 * client (page.tsx) buat truncate teks hasil ekstraksi docx/txt SEBELUM
 * dikirim ke server -- lihat MAX_FILE_SIZE_BYTES di bawah kenapa ini
 * penting buat jalur docx/txt.
 *
 * TUNING LOG (jangan naikin tanpa data baru di bawah ini):
 *   - 69.000 karakter -> gemini-parallel 21.8s (2026-08-15)
 *   - 150.000 karakter -> gemini-parallel 33.6s (2026-08-16)
 *   - Model linear dari 2 titik ini: base ~11.75s + ~0.146s/1000 karakter
 *   - Target aman: total-request <= ~48s (buffer 12s dari hard limit
 *     Vercel 60s) -> ~220.000 karakter
 *   - Nilai di bawah adalah titik ukur berikutnya, BUKAN angka final.
 *     Update log ini tiap kali dites ulang dengan data produksi baru.
 */
export const MAX_DOC_CHARS = 220_000;

/**
 * Batas ukuran file MENTAH yang dikirim LANGSUNG ke server sebagai body
 * request -- ini angka hard limit Vercel buat ukuran payload masuk ke
 * serverless function.
 *
 * PENTING: ini HANYA relevan buat jalur PDF (dikirim via FormData, raw
 * bytes file = ukuran payload beneran). JANGAN dipakai buat cek raw file
 * size docx/txt -- untuk docx/txt, ekstraksi teks terjadi DI CLIENT
 * (mammoth) SEBELUM dikirim ke server, jadi yang dikirim adalah teks
 * hasil ekstraksi (JSON), bukan file docx/txt mentahnya. Docx 16MB bisa
 * aja teksnya cuma ratusan KB setelah diekstrak -- ngecek raw file size
 * di titik itu bakal nolak upload yang sebenernya valid.
 *
 * Buat docx/txt, kontrol yang relevan adalah panjang TEKS hasil
 * ekstraksi vs MAX_DOC_CHARS (lihat page.tsx, processFile).
 */
export const MAX_FILE_SIZE_BYTES = 4.5 * 1024 * 1024; // 4.5MB