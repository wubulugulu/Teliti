"use client";

import { useState } from "react";
import type { ScanRecord } from "@/app/page";

type Props = {
  scan: ScanRecord;
  activeHighlight: string | null;
  onHighlightSelect: (id: string | null) => void;
};

const sevColor = {
  high: { text: "var(--red)", bg: "var(--red-bg)", label: "Tinggi" },
  medium: { text: "var(--amber)", bg: "var(--amber-bg)", label: "Sedang" },
  low: { text: "#CA8A04", bg: "#FFFBEB", label: "Rendah" },
};

function IntegrityGauge({ score }: { score: number }) {
  const color = score >= 75 ? "var(--green)" : score >= 50 ? "var(--amber)" : "var(--red)";
  const label = score >= 90 ? "Sempurna" : score >= 75 ? "Baik" : score >= 60 ? "Cukup" : score >= 40 ? "Kurang" : "Buruk";

  return (
    <div className="px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
      <p className="text-xs font-600 mb-3" style={{ color: "var(--text-muted)" }}>INTEGRITY SCORE</p>
      <div className="flex items-end gap-3 mb-3">
        <span className="text-5xl font-700 tabular-nums leading-none" style={{ color }}>{score}</span>
        <span className="text-lg mb-1" style={{ color: "var(--text-muted)" }}>/100</span>
        <span className="text-sm font-600 mb-1" style={{ color }}>{label}</span>
      </div>
      {/* Bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function ResultPanel({ scan, activeHighlight, onHighlightSelect }: Props) {
  const [tab, setTab] = useState<"bias" | "consistency">("bias");
  const { biasResult, consistencyResult, integrityScore } = scan;

  const biases = biasResult?.biases ?? [];
  const issues = consistencyResult?.issues ?? [];
  const sections = consistencyResult?.sections ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Integrity score */}
      {integrityScore !== null && <IntegrityGauge score={integrityScore} />}

      {/* Tabs */}
      <div className="flex border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setTab("bias")}
          className="flex-1 py-3 text-xs font-600 transition-colors relative"
          style={{ color: tab === "bias" ? "var(--teal)" : "var(--text-muted)" }}
        >
          Bias {biases.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: "var(--teal-light)", color: "var(--teal-dark)" }}>{biases.length}</span>}
          {tab === "bias" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "var(--teal)" }} />
          )}
        </button>
        <button
          onClick={() => setTab("consistency")}
          className="flex-1 py-3 text-xs font-600 transition-colors relative"
          style={{ color: tab === "consistency" ? "var(--teal)" : "var(--text-muted)" }}
        >
          Konsistensi {issues.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs" style={{ background: "#FEE2E2", color: "var(--red)" }}>{issues.length}</span>}
          {tab === "consistency" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "var(--teal)" }} />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "bias" && (
          <div className="p-4 space-y-2">
            {/* Summary */}
            {biasResult?.summary && (
              <div className="rounded-xl p-4 mb-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-600 mb-1" style={{ color: "var(--text-muted)" }}>RINGKASAN</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{biasResult.summary}</p>
                <div className="flex gap-3 mt-3">
                  {(["high", "medium", "low"] as const).map((sev) => {
                    const count = biases.filter((b) => b.severity === sev).length;
                    const cfg = sevColor[sev];
                    return (
                      <div key={sev} className="text-center">
                        <p className="text-base font-700" style={{ color: cfg.text }}>{count}</p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{cfg.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {biases.length === 0 ? (
              <div
                className="rounded-xl p-5 text-center"
                style={{ background: "var(--green-bg)", border: "1px solid #BBF7D0" }}
              >
                <p className="text-sm font-600" style={{ color: "var(--green)" }}>Tidak ada bias terdeteksi</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Teks cukup netral dan inklusif.</p>
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
                      border: `1px solid ${isActive ? "var(--teal)" : "var(--border)"}`,
                      background: isActive ? "var(--teal-bg)" : "var(--bg-card)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs font-600 px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs font-500" style={{ color: "var(--text-secondary)" }}>{bias.type}</span>
                    </div>
                    <p className="text-xs italic mb-2 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                      "{bias.sentence}"
                    </p>
                    <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--text-muted)" }}>
                      {bias.explanation}
                    </p>
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--green-bg)", border: "1px solid #BBF7D0" }}>
                      <p className="text-xs font-600 mb-0.5" style={{ color: "var(--green)" }}>Saran</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{bias.suggestion}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "consistency" && (
          <div className="p-4 space-y-2">
            {/* Overall */}
            {consistencyResult?.overall && (
              <div className="rounded-xl p-4 mb-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-600 mb-1" style={{ color: "var(--text-muted)" }}>PENILAIAN UMUM</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{consistencyResult.overall}</p>
                {sections.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {sections.map((s: any, i: number) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "var(--teal-light)", color: "var(--teal-dark)" }}
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {issues.length === 0 ? (
              <div
                className="rounded-xl p-5 text-center"
                style={{ background: "var(--green-bg)", border: "1px solid #BBF7D0" }}
              >
                <p className="text-sm font-600" style={{ color: "var(--green)" }}>Dokumen konsisten</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Tidak ada inkonsistensi signifikan.</p>
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
                      border: `1px solid ${isActive ? "var(--teal)" : "var(--border)"}`,
                      background: isActive ? "var(--teal-bg)" : "var(--bg-card)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="text-xs font-600 px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{issue.category}</span>
                    </div>
                    <p className="text-xs font-600 mb-1" style={{ color: "var(--text-primary)" }}>{issue.title}</p>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                      {issue.section_a} ↔ {issue.section_b}
                    </p>
                    <p className="text-xs leading-relaxed mb-2" style={{ color: "var(--text-secondary)" }}>
                      {issue.description}
                    </p>
                    <div className="rounded-lg px-3 py-2" style={{ background: "var(--green-bg)", border: "1px solid #BBF7D0" }}>
                      <p className="text-xs font-600 mb-0.5" style={{ color: "var(--green)" }}>Saran</p>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{issue.suggestion}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}