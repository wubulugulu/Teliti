import type { ScanRecord } from "@/types";

export async function exportToPDF(scan: ScanRecord): Promise<void> {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // ── FONT EMBED (Plus Jakarta Sans) ──────────────────────────────────
  // jsPDF cuma punya helvetica/times/courier built-in. Buat pakai Plus
  // Jakarta Sans, harus embed file .ttf sebagai base64 lewat VFS.
  // Taruh file font di public/fonts/, lalu fetch + convert base64 di sini,
  // ATAU generate module base64 statis (lihat catatan di bawah file ini).
  let FONT = "helvetica"; // fallback aman kalau embed gagal
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch("/fonts/PlusJakartaSans-Regular.ttf"),
      fetch("/fonts/PlusJakartaSans-Bold.ttf"),
    ]);
    if (!regularRes.ok || !boldRes.ok) {
      throw new Error(
        `Font file(s) not found (regular: ${regularRes.status}, bold: ${boldRes.status}). Taruh .ttf di public/fonts/`
      );
    }
    const [regularBuf, boldBuf] = await Promise.all([
      regularRes.arrayBuffer(),
      boldRes.arrayBuffer(),
    ]);
    const toBase64 = (buf: ArrayBuffer) => {
      let binary = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    };
    doc.addFileToVFS("PlusJakartaSans-Regular.ttf", toBase64(regularBuf));
    doc.addFont("PlusJakartaSans-Regular.ttf", "PlusJakartaSans", "normal");
    doc.addFileToVFS("PlusJakartaSans-Bold.ttf", toBase64(boldBuf));
    doc.addFont("PlusJakartaSans-Bold.ttf", "PlusJakartaSans", "bold");
    FONT = "PlusJakartaSans";
  } catch (e) {
    console.warn("Font embed gagal, fallback ke helvetica:", e);
  }
  // NOTE: TTF custom di jsPDF cuma bisa punya style "normal" dan "bold" per
  // family yang di-register. Gak ada bolditalic/italic asli kecuali kamu
  // embed file .ttf italic terpisah dan register style "italic" /
  // "bolditalic" sendiri. Di bawah, semua pemakaian "bolditalic" diganti
  // "bold" biar konsisten dengan 1 family ini (quote tetap dikasih tanda
  // kutip manual sebagai penanda visual, bukan italic).

  const pageW = 210;
  const pageH = 297;
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 0;

  const biases = scan.biasResult?.biases ?? [];
  const issues = scan.consistencyResult?.issues ?? [];
  const integrityScore = scan.integrityScore ?? 0;

  // Colors
  const TEAL: [number, number, number] = [13, 148, 136];
  const TEAL_LIGHT: [number, number, number] = [240, 253, 250];
  const TEAL_DARK: [number, number, number] = [15, 118, 110];
  const TEXT: [number, number, number] = [11, 28, 48];
  const MUTED: [number, number, number] = [109, 122, 119];
  const BORDER: [number, number, number] = [229, 238, 255];
  const WHITE: [number, number, number] = [255, 255, 255];
  const RED: [number, number, number] = [220, 38, 38];
  const RED_LIGHT: [number, number, number] = [254, 226, 226];
  const AMBER: [number, number, number] = [217, 119, 6];
  const AMBER_LIGHT: [number, number, number] = [255, 251, 235];
  const GREEN: [number, number, number] = [22, 163, 74];
  const GREEN_LIGHT: [number, number, number] = [240, 253, 244];
  const GRAY_BG: [number, number, number] = [249, 250, 251];
  const GRAY_BORDER: [number, number, number] = [229, 231, 235];

  function scoreColor(s: number): [number, number, number] {
    return s >= 75 ? GREEN : s >= 50 ? AMBER : RED;
  }
  function scoreLabel(s: number): string {
    if (s >= 90) return "Sempurna";
    if (s >= 75) return "Baik";
    if (s >= 60) return "Cukup";
    if (s >= 40) return "Kurang";
    if (s >= 20) return "Buruk";
    return "Sangat Buruk";
  }
  function sevCfg(sev: string) {
    if (sev === "high") return { color: RED, bg: RED_LIGHT, label: "Tinggi", border: RED };
    if (sev === "medium") return { color: AMBER, bg: AMBER_LIGHT, label: "Sedang", border: AMBER };
    return { color: GREEN, bg: GREEN_LIGHT, label: "Rendah", border: GREEN };
  }

  // ── FIX UTAMA ────────────────────────────────────────────────────
  // wrapText sekarang WAJIB set font+style yang SAMA PERSIS dengan yang
  // dipakai saat render. Ini yang bikin teks overflow sebelumnya: font
  // di-set SETELAH wrap, jadi lebar yang dihitung beda dengan lebar
  // aktual pas ditulis.
  function wrapText(
    text: string,
    maxW: number,
    fontSize: number,
    style: "normal" | "bold" = "normal"
  ): string[] {
    doc.setFont(FONT, style);
    doc.setFontSize(fontSize);
    const words = text.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      // guard: kalau satu kata sendirian sudah lebih lebar dari maxW
      // (kata panjang tanpa spasi), paksa masuk baris sendiri biar
      // gak infinite-loop / gak pernah ke-push.
      if (doc.getTextWidth(test) <= maxW || !cur) {
        cur = test;
      } else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function checkPage(needed: number) {
    if (y + needed > pageH - 22) {
      doc.addPage();
      y = 20;
    }
  }

  // ── HEADER ─────────────────────────────────────────────────────────
  doc.setFillColor(...WHITE);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(0, 22, pageW, 22);

  doc.setFontSize(11);
  doc.setFont(FONT, "bold");
  doc.setTextColor(...TEAL);
  doc.text("t", margin, 14);

  doc.setFontSize(8);
  doc.setFont(FONT, "bold");
  doc.setTextColor(...TEXT);
  doc.text("Document Analysis Report", margin + 6, 11);

  doc.setFontSize(7);
  doc.setFont(FONT, "normal");
  doc.setTextColor(...MUTED);
  const fileName = scan.fileName || "Dokumen";
  doc.text(fileName, margin + 6, 16.5);

  const dateStr = scan.timestamp instanceof Date
    ? scan.timestamp.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("id-ID");
  const timeStr = scan.timestamp instanceof Date
    ? scan.timestamp.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : "";

  const reportId = `#TLT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}`;
  doc.setFontSize(7);
  doc.setFont(FONT, "normal");
  doc.setTextColor(...MUTED);
  doc.text(`Report ID: ${reportId}`, pageW - margin, 9, { align: "right" });
  doc.text(`Generated: ${dateStr}, ${timeStr}`, pageW - margin, 14, { align: "right" });
  doc.text("ITFest 6.0 · Universitas Paramadina", pageW - margin, 19, { align: "right" });

  y = 30;

  // ── INTEGRITY SCORE + EXECUTIVE SUMMARY CARD ───────────────────────
  const cardH = 52;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...GRAY_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, cardH, 3, 3, "FD");

  const leftW = 52;
  doc.setFontSize(7);
  doc.setFont(FONT, "normal");
  doc.setTextColor(...MUTED);
  doc.text("INTEGRITY SCORE", margin + 6, y + 10);

  const sColor = scoreColor(integrityScore);
  doc.setFontSize(28);
  doc.setFont(FONT, "bold");
  doc.setTextColor(...sColor);
  doc.text(String(integrityScore), margin + 6, y + 28);
  const numW = doc.getTextWidth(String(integrityScore));

  doc.setFontSize(11);
  doc.setFont(FONT, "normal");
  doc.setTextColor(...MUTED);
  doc.text("/100", margin + 6 + numW + 1, y + 27);

  doc.setFontSize(8);
  doc.setFont(FONT, "bold");
  doc.setTextColor(...sColor);
  doc.text(`Status: ${scoreLabel(integrityScore)}`, margin + 6, y + 36);

  const barX = margin + 6;
  const barY = y + 41;
  const barW = leftW - 6;
  doc.setFillColor(...GRAY_BORDER);
  doc.roundedRect(barX, barY, barW, 2.5, 1, 1, "F");
  doc.setFillColor(...sColor);
  doc.roundedRect(barX, barY, Math.max(2, (barW * integrityScore) / 100), 2.5, 1, 1, "F");

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin + leftW, y + 8, margin + leftW, y + cardH - 8);

  const rightX = margin + leftW + 8;
  const rightW = contentW - leftW - 16;

  doc.setFontSize(7.5);
  doc.setFont(FONT, "bold");
  doc.setTextColor(...TEAL);
  doc.text("EXECUTIVE SUMMARY", rightX, y + 10);

  const statW = (rightW - 8) / 3;
  const stats = [
    { val: String(biases.length), label: "Bias Terdeteksi", highlight: false },
    { val: String(biases.filter(b => b.severity === "high").length), label: "Severity Tinggi", highlight: biases.filter(b => b.severity === "high").length > 0 },
    { val: String(issues.length), label: "Inkonsistensi", highlight: false },
  ];

  stats.forEach((s, i) => {
    const sx = rightX + i * (statW + 4);
    const sy = y + 16;
    const sh = 28;

    if (s.highlight) {
      doc.setFillColor(...RED_LIGHT);
      doc.setDrawColor(...RED_LIGHT);
    } else {
      doc.setFillColor(...GRAY_BG);
      doc.setDrawColor(...GRAY_BORDER);
    }
    doc.roundedRect(sx, sy, statW, sh, 2, 2, "FD");

    doc.setFontSize(18);
    doc.setFont(FONT, "bold");
    doc.setTextColor(...(s.highlight ? RED : TEXT));
    doc.text(s.val, sx + statW / 2, sy + 16, { align: "center" });

    doc.setFontSize(6.5);
    doc.setFont(FONT, "normal");
    doc.setTextColor(...MUTED);
    doc.text(s.label, sx + statW / 2, sy + 22, { align: "center" });
  });

  y += cardH + 10;

  function sectionTitle(title: string) {
    checkPage(14);
    doc.setFontSize(8);
    doc.setFont(FONT, "bold");
    doc.setTextColor(...TEAL);
    doc.text(title, margin, y);
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 2, margin + contentW, y + 2);
    y += 10;
  }

  // ── DETEKSI BIAS ──────────────────────────────────────────────────
  sectionTitle("DETEKSI BIAS");

  if (scan.biasResult?.summary) {
    checkPage(28);
    const sumLines = wrapText(scan.biasResult.summary, contentW - 14, 7.5, "normal");
    const sumH = 14 + sumLines.length * 4.5;

    doc.setFillColor(...TEAL_LIGHT);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, sumH, 2, 2, "FD");

    doc.setFontSize(6.5);
    doc.setFont(FONT, "bold");
    doc.setTextColor(...TEAL_DARK);
    doc.text("RINGKASAN", margin + 6, y + 7);

    doc.setFont(FONT, "normal");
    doc.setTextColor(...TEXT);
    doc.setFontSize(7.5);
    sumLines.forEach((line, i) => {
      doc.text(line, margin + 6, y + 13 + i * 4.5);
    });

    y += sumH + 5;
  }

  if (biases.length === 0) {
    checkPage(16);
    doc.setFillColor(...GREEN_LIGHT);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setFont(FONT, "bold");
    doc.setTextColor(...GREEN);
    doc.text("Tidak ada bias terdeteksi", margin + contentW / 2, y + 9, { align: "center" });
    y += 20;
  } else {
    biases.forEach((bias, idx) => {
      const cfg = sevCfg(bias.severity);

      // FIX: wrap pakai style "bold" karena dirender bold (pengganti bolditalic)
      const sentLines = wrapText(`"${bias.sentence}"`, contentW - 20, 7.5, "bold");
      const expLines = wrapText(bias.explanation, contentW - 14, 7.5, "normal");
      const sugLines = wrapText(bias.suggestion, contentW - 20, 7.5, "normal");
      const cardH = 14 + sentLines.length * 4.5 + 3 + expLines.length * 4.5 + 4 + sugLines.length * 4.5 + 16;

      checkPage(cardH + 6);

      doc.setFillColor(...WHITE);
      doc.setDrawColor(...GRAY_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentW, cardH, 2, 2, "FD");

      doc.setFillColor(...cfg.color);
      doc.roundedRect(margin, y, 3, cardH, 1, 1, "F");

      let cy = y + 8;

      const pillW = 14;
      doc.setFillColor(...cfg.bg);
      doc.setDrawColor(...cfg.bg);
      doc.roundedRect(margin + 7, cy - 4.5, pillW, 6, 2, 2, "F");
      doc.setFontSize(6.5);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...cfg.color);
      doc.text(cfg.label, margin + 7 + pillW / 2, cy, { align: "center" });

      doc.setFontSize(7);
      doc.setFont(FONT, "normal");
      doc.setTextColor(...MUTED);
      doc.text(bias.type, margin + 24, cy);

      doc.text(`#${idx + 1}`, pageW - margin - 4, cy, { align: "right" });

      cy += 5;

      doc.setDrawColor(...BORDER);
      doc.line(margin + 7, cy, margin + contentW - 4, cy);
      cy += 4;

      // Sentence — render pakai FONT+bold (font custom gak punya italic asli)
      doc.setFontSize(7.5);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...TEXT);
      sentLines.forEach((line) => { doc.text(line, margin + 7, cy); cy += 4.5; });

      cy += 2;

      doc.setFont(FONT, "normal");
      doc.setTextColor(...MUTED);
      doc.setFontSize(7.5);
      expLines.forEach((line) => { doc.text(line, margin + 7, cy); cy += 4.5; });

      cy += 3;

      const sugH = sugLines.length * 4.5 + 10;
      doc.setFillColor(...GREEN_LIGHT);
      doc.setDrawColor(187, 247, 208);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin + 7, cy, contentW - 14, sugH, 2, 2, "FD");

      doc.setFontSize(6.5);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...GREEN);
      doc.text("Saran Perbaikan", margin + 11, cy + 6);

      doc.setFont(FONT, "normal");
      doc.setTextColor(...TEXT);
      doc.setFontSize(7.5);
      sugLines.forEach((line, li) => { doc.text(line, margin + 11, cy + 11 + li * 4.5); });

      y += cardH + 5;
    });
  }

  y += 6;

  // ── CEK KONSISTENSI ───────────────────────────────────────────────
  sectionTitle("CEK KONSISTENSI");

  if (scan.consistencyResult?.overall) {
    checkPage(28);
    const overallLines = wrapText(scan.consistencyResult.overall, contentW - 14, 7.5, "normal");
    const overallH = 14 + overallLines.length * 4.5;

    doc.setFillColor(...TEAL_LIGHT);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, overallH, 2, 2, "FD");

    doc.setFontSize(6.5);
    doc.setFont(FONT, "bold");
    doc.setTextColor(...TEAL_DARK);
    doc.text("PENILAIAN UMUM", margin + 6, y + 7);

    doc.setFont(FONT, "normal");
    doc.setTextColor(...TEXT);
    doc.setFontSize(7.5);
    overallLines.forEach((line, i) => { doc.text(line, margin + 6, y + 13 + i * 4.5); });

    y += overallH + 5;
  }

  if (issues.length === 0) {
    checkPage(16);
    doc.setFillColor(...GREEN_LIGHT);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setFont(FONT, "bold");
    doc.setTextColor(...GREEN);
    doc.text("Dokumen konsisten", margin + contentW / 2, y + 9, { align: "center" });
    y += 20;
  } else {
    issues.forEach((issue: any, idx: number) => {
      const cfg = sevCfg(issue.severity);
      const titleLines = wrapText(issue.title, contentW - 20, 8, "bold");
      // FIX: section_a/section_b bisa panjang (contoh: "Methods (2.7 User-Based
      // Evaluation / Figure 7)  →  Results and Discussions (3.4 Discussion / Table 2)")
      // — sebelumnya SAMA SEKALI gak di-wrap, makanya paling parah overflow-nya.
      const sectionLines = wrapText(
        `${issue.section_a}  →  ${issue.section_b}`,
        contentW - 14,
        7,
        "normal"
      );
      const descLines = wrapText(issue.description, contentW - 14, 7.5, "normal");
      const sugLines = wrapText(issue.suggestion, contentW - 20, 7.5, "normal");
      const cardH =
        14 +
        titleLines.length * 5 +
        2 +
        sectionLines.length * 4 +
        4 +
        descLines.length * 4.5 +
        4 +
        sugLines.length * 4.5 +
        16;

      checkPage(cardH + 6);

      doc.setFillColor(...WHITE);
      doc.setDrawColor(...GRAY_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentW, cardH, 2, 2, "FD");

      doc.setFillColor(...cfg.color);
      doc.roundedRect(margin, y, 3, cardH, 1, 1, "F");

      let cy = y + 8;

      const pillW = 14;
      doc.setFillColor(...cfg.bg);
      doc.setDrawColor(...cfg.bg);
      doc.roundedRect(margin + 7, cy - 4.5, pillW, 6, 2, 2, "F");
      doc.setFontSize(6.5);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...cfg.color);
      doc.text(cfg.label, margin + 7 + pillW / 2, cy, { align: "center" });

      doc.setFontSize(7);
      doc.setFont(FONT, "normal");
      doc.setTextColor(...MUTED);
      doc.text(issue.category || "", margin + 24, cy);
      doc.text(`#${idx + 1}`, pageW - margin - 4, cy, { align: "right" });

      cy += 5;
      doc.setDrawColor(...BORDER);
      doc.line(margin + 7, cy, margin + contentW - 4, cy);
      cy += 4;

      doc.setFontSize(8);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...TEXT);
      titleLines.forEach((line) => { doc.text(line, margin + 7, cy); cy += 5; });

      cy += 1;

      // Section arrow — sekarang di-wrap dan render per-baris
      doc.setFontSize(7);
      doc.setFont(FONT, "normal");
      doc.setTextColor(...TEAL);
      sectionLines.forEach((line) => { doc.text(line, margin + 7, cy); cy += 4; });
      cy += 3;

      doc.setTextColor(...MUTED);
      doc.setFontSize(7.5);
      descLines.forEach((line) => { doc.text(line, margin + 7, cy); cy += 4.5; });

      cy += 3;

      const sugH = sugLines.length * 4.5 + 10;
      doc.setFillColor(...GREEN_LIGHT);
      doc.setDrawColor(187, 247, 208);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin + 7, cy, contentW - 14, sugH, 2, 2, "FD");
      doc.setFontSize(6.5);
      doc.setFont(FONT, "bold");
      doc.setTextColor(...GREEN);
      doc.text("Saran Perbaikan", margin + 11, cy + 6);
      doc.setFont(FONT, "normal");
      doc.setTextColor(...TEXT);
      doc.setFontSize(7.5);
      sugLines.forEach((line, li) => { doc.text(line, margin + 11, cy + 11 + li * 4.5); });

      y += cardH + 5;
    });
  }

  // ── FOOTER ────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFontSize(6.5);
    doc.setFont(FONT, "normal");
    doc.setTextColor(...MUTED);
    doc.text("© 2024 Teliti Intelligence Systems. Confidential Document Analysis Report.", margin, pageH - 7);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, pageH - 7, { align: "right" });
  }

  const safeName = (scan.fileName || "dokumen").replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "_");
  doc.save(`Teliti_Report_${safeName}.pdf`);
}