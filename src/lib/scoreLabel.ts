/**
 * Label kualitatif untuk skor 0-100 di mana ANGKA LEBIH TINGGI = LEBIH BAIK.
 *
 * Dipakai oleh:
 *  - Integrity Score  (ResultPanel.tsx, report/[id]/page.tsx, exportPDF.ts)
 *  - Consistency Score (ConsistencyResult.tsx)
 *
 * Threshold WAJIB identik di seluruh app. Kalau tidak, skor yang sama bisa
 * tampil dengan label berbeda di dashboard vs PDF export vs laporan publik
 * (/report/[id]) — inkonsistensi yang langsung kelihatan user.
 *
 * JANGAN pakai fungsi ini untuk Bias Score mentah (`biasResult.score`).
 * Bias Score berskala TERBALIK: 0 = bersih, 100 = penuh bias. Untuk itu
 * pakai `biasScoreLabel` di src/components/BiasResult.tsx.
 */
export function scoreLabel(score: number): string {
  if (score >= 90) return "Sempurna";
  if (score >= 75) return "Baik";
  if (score >= 60) return "Cukup";
  if (score >= 40) return "Kurang";
  if (score >= 20) return "Buruk";
  return "Sangat Buruk";
}