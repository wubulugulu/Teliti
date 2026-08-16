/**
 * Batas jumlah karakter dokumen yang dikirim ke Gemini per panggilan.
 *
 * WAJIB satu-satunya sumber angka ini -- dipakai di route.ts (buat
 * truncate + hitung documentCoverage) dan juga di bias-analysis.ts /
 * consistency-check.ts (truncate independen sebagai defense-in-depth,
 * kalau-kalau salah satu fungsi itu dipanggil langsung tanpa lewat
 * route.ts, misal dari endpoint lain di masa depan).
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