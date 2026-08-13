"use client";

import { useState } from "react";
import type { ScanRecord } from "@/types";

type Props = {
  scan: ScanRecord;
  activeHighlight: string | null;
  onHighlightSelect: (id: string | null) => void;
};

const sevColor = {
  high: { text: "#DC2626", bg: "#FEE2E2", label: "Tinggi" },
  medium: { text: "#D97706", bg: "#FFFBEB", label: "Sedang" },
  low: { text: "#CA8A04", bg: "#FFFBEB", label: "Rendah" },
};

function scoreColor(score: number) {
  if (score >= 75) return "#16A34A";
  if (score >= 50) return "#D97706";
  return "#DC2626";
}

function scoreLabel(score: number) {
  if (score >= 90) return "Sempurna";
  if (score >= 75) return "Baik";
  if (score >= 60) return "Cukup";
  if (score >= 40) return "Kurang";
  if (score >= 20) return "Buruk";
  return "Sangat Buruk";
}

function IntegrityGauge({
  score,
  onExport,
  exporting,
}: {
  score: number;
  onExport: () => void;
  exporting: boolean;
}) {
  const color = scoreColor(score);
  const label = scoreLabel(score);

  return (
    <div className="px-5 py-5 border-b border-[#e5eeff]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-[#6d7a77] uppercase tracking-widest">
          Integrity Score
        </p>
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors disabled:opacity-50"
        >
          {exporting ? (
            <div className="w-3 h-3 rounded-full border-2 border-teal-300 border-t-teal-600 animate-spin" />
          ) : (
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
              <path
                d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {exporting ? "Membuat..." : "Export PDF"}
        </button>
      </div>
      <div className="flex items-end gap-2 mb-3">
        <span className="text-5xl font-bold tabular-nums leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-lg mb-1 text-[#6d7a77]">/100</span>
        <span className="text-sm font-bold mb-1" style={{ color }}>
          {label}
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-[#e5eeff]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}

function RewriteModal({
  originalText,
  revisedText,
  changeCount,
  onClose,
}: {
  originalText: string;
  revisedText: string;
  changeCount: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(revisedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([revisedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dokumen-revisi.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5eeff] flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-[#0b1c30]">Dokumen Revisi</p>
            <p className="text-xs text-[#6d7a77]">
              {changeCount} bagian diperbaiki otomatis oleh AI
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors font-semibold"
            >
              {copied ? "Tersalin!" : "Salin Teks"}
            </button>
            <button
              onClick={handleDownload}
              className="text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition-colors font-semibold"
            >
              Download .txt
            </button>
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg text-[#6d7a77] hover:bg-[#f0fdfa] transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 border-r border-[#e5eeff]">
            <p className="text-[10px] font-bold text-[#6d7a77] uppercase tracking-widest mb-3 sticky top-0 bg-white">
              Sebelum
            </p>
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-[#6d7a77]">
              {originalText}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-5 bg-[#f0fdfa]/40">
            <p className="text-[10px] font-bold text-teal-700 uppercase tracking-widest mb-3 sticky top-0">
              Sesudah
            </p>
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-[#0b1c30]">
              {revisedText}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultPanel({ scan, activeHighlight, onHighlightSelect }: Props) {
  const [tab, setTab] = useState<"bias" | "consistency">("bias");
  const [exporting, setExporting] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState("");
  const [rewriteData, setRewriteData] = useState<{ revisedText: string; changeCount: number } | null>(
    null
  );
  const { biasResult, consistencyResult, integrityScore, documentText } = scan;

  const biases = biasResult?.biases ?? [];
  const issues = consistencyResult?.issues ?? [];
  const sections = consistencyResult?.sections ?? [];

  const handleExport = async () => {
    setExporting(true);
    try {
      const { exportToPDF } = await import("@/lib/exportPDF");
      await exportToPDF(scan);
    } catch (e) {
      console.error("Export gagal:", e);
    } finally {
      setExporting(false);
    }
  };

  const handleRewrite = async () => {
    setRewriting(true);
    setRewriteError("");
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: documentText, biases, issues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat dokumen revisi");
      setRewriteData(data);
    } catch (e: unknown) {
      setRewriteError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setRewriting(false);
    }
  };

  const hasFindings = biases.length > 0 || issues.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Integrity Score + Export */}
      {integrityScore !== null && (
        <IntegrityGauge score={integrityScore} onExport={handleExport} exporting={exporting} />
      )}

      {/* Rewrite CTA */}
      {hasFindings && (
        <div className="px-5 py-3 border-b border-[#e5eeff] flex-shrink-0">
          <button
            onClick={handleRewrite}
            disabled={rewriting}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 text-white text-xs font-semibold hover:shadow-[0_4px_16px_rgba(13,148,136,0.35)] transition-all disabled:opacity-60"
          >
            {rewriting ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Membuat dokumen revisi...
              </>
            ) : (
              <>Generate Dokumen Revisi</>
            )}
          </button>
          {rewriteError && (
            <p className="text-xs text-red-500 mt-2">{rewriteError}</p>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#e5eeff] flex-shrink-0">
        <button
          onClick={() => setTab("bias")}
          className="flex-1 py-3 text-xs font-semibold transition-colors relative"
          style={{ color: tab === "bias" ? "#0d9488" : "#6d7a77" }}
        >
          Bias{" "}
          {biases.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700">
              {biases.length}
            </span>
          )}
          {tab === "bias" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
          )}
        </button>
        <button
          onClick={() => setTab("consistency")}
          className="flex-1 py-3 text-xs font-semibold transition-colors relative"
          style={{ color: tab === "consistency" ? "#0d9488" : "#6d7a77" }}
        >
          Konsistensi{" "}
          {issues.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-50 text-red-500">
              {issues.length}
            </span>
          )}
          {tab === "consistency" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "bias" && (
          <div className="p-4 space-y-2">
            {biasResult?.summary && (
              <div className="rounded-xl p-4 mb-3 bg-[#f0fdfa] border border-[#e5eeff]">
                <p className="text-[10px] font-bold text-[#6d7a77] uppercase tracking-widest mb-1">
                  Ringkasan
                </p>
                <p className="text-xs leading-relaxed text-[#3d4947]">{biasResult.summary}</p>
                <div className="flex gap-4 mt-3">
                  {(["high", "medium", "low"] as const).map((sev) => {
                    const count = biases.filter((b) => b.severity === sev).length;
                    const cfg = sevColor[sev];
                    return (
                      <div key={sev} className="text-center">
                        <p className="text-base font-bold" style={{ color: cfg.text }}>
                          {count}
                        </p>
                        <p className="text-xs text-[#6d7a77]">{cfg.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {biases.length === 0 ? (
              <div className="rounded-xl p-5 text-center bg-green-50 border border-green-200">
                <p className="text-sm font-semibold text-green-600">Tidak ada bias terdeteksi</p>
                <p className="text-xs mt-1 text-[#6d7a77]">Teks cukup netral dan inklusif.</p>
              </div>
            ) : (
              biases.map((bias, i) => {
                const id = `bias-${i}`;
                const cfg = sevColor[bias.severity];
                const isActive = activeHighlight === id;
                return (
                  <div
                    key={i}
                    onClick={() => onHighlightSelect(isActive ? null : id)}
                    className="rounded-xl p-4 cursor-pointer transition-all"
                    style={{
                      border: `1px solid ${isActive ? "#0d9488" : "#e5eeff"}`,
                      background: isActive ? "#f0fdfa" : "white",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs text-[#6d7a77]">{bias.type}</span>
                    </div>
                    <p className="text-xs italic mb-2 line-clamp-2 text-[#3d4947]">
                      "{bias.sentence}"
                    </p>
                    <p className="text-xs leading-relaxed mb-2 text-[#6d7a77]">
                      {bias.explanation}
                    </p>
                    <div className="rounded-lg px-3 py-2 bg-green-50 border border-green-100">
                      <p className="text-xs font-semibold mb-0.5 text-green-600">Saran</p>
                      <p className="text-xs leading-relaxed text-[#3d4947]">{bias.suggestion}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "consistency" && (
          <div className="p-4 space-y-2">
            {consistencyResult?.overall && (
              <div className="rounded-xl p-4 mb-3 bg-[#f0fdfa] border border-[#e5eeff]">
                <p className="text-[10px] font-bold text-[#6d7a77] uppercase tracking-widest mb-1">
                  Penilaian Umum
                </p>
                <p className="text-xs leading-relaxed text-[#3d4947]">{consistencyResult.overall}</p>
                {sections.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {sections.map((s: any, i: number) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {issues.length === 0 ? (
              <div className="rounded-xl p-5 text-center bg-green-50 border border-green-200">
                <p className="text-sm font-semibold text-green-600">Dokumen konsisten</p>
                <p className="text-xs mt-1 text-[#6d7a77]">
                  Tidak ada inkonsistensi signifikan.
                </p>
              </div>
            ) : (
              issues.map((issue: any, i: number) => {
                const id = `consistency-${i}`;
                const cfg = sevColor[issue.severity as "low" | "medium" | "high"];
                const isActive = activeHighlight === id;
                return (
                  <div
                    key={i}
                    onClick={() => onHighlightSelect(isActive ? null : id)}
                    className="rounded-xl p-4 cursor-pointer transition-all"
                    style={{
                      border: `1px solid ${isActive ? "#0d9488" : "#e5eeff"}`,
                      background: isActive ? "#f0fdfa" : "white",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs text-[#6d7a77]">{issue.category}</span>
                    </div>
                    <p className="text-xs font-semibold mb-1 text-[#0b1c30]">{issue.title}</p>
                    <p className="text-xs mb-1 text-teal-600">
                      {issue.section_a} vs {issue.section_b}
                    </p>
                    <p className="text-xs leading-relaxed mb-2 text-[#6d7a77]">
                      {issue.description}
                    </p>
                    <div className="rounded-lg px-3 py-2 bg-green-50 border border-green-100">
                      <p className="text-xs font-semibold mb-0.5 text-green-600">Saran</p>
                      <p className="text-xs leading-relaxed text-[#3d4947]">{issue.suggestion}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {rewriteData && (
        <RewriteModal
          originalText={documentText}
          revisedText={rewriteData.revisedText}
          changeCount={rewriteData.changeCount}
          onClose={() => setRewriteData(null)}
        />
      )}
    </div>
  );
}