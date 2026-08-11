"use client";

type Section = { name: string; summary: string };
type Issue = {
  title: string;
  severity: "low" | "medium" | "high";
  category: string;
  section_a: string;
  section_b: string;
  description: string;
  suggestion: string;
};

export type ConsistencyResult = {
  sections: Section[];
  consistency_score: number;
  overall: string;
  issues: Issue[];
};

type Props = { result: ConsistencyResult; onReset: () => void };

const sevConfig = {
  low: { label: "Ringan", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  medium: { label: "Sedang", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  high: { label: "Kritis", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
};

const scoreColor = (s: number) =>
  s >= 75 ? "text-green-400" : s >= 60 ? "text-yellow-400" : s >= 40 ? "text-orange-400" : "text-red-400";

const scoreLabel = (s: number) =>
  s >= 90 ? "Sempurna" :
    s >= 75 ? "Baik" :
      s >= 60 ? "Cukup" :
        s >= 40 ? "Kurang" :
          s >= 20 ? "Buruk" : "Sangat Buruk";

const categoryColors: Record<string, string> = {
  "Konsistensi Logis": "text-violet-400 bg-violet-400/10 border-violet-400/20",
  "Data & Angka": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "Terminologi": "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  "Figure & Tabel": "text-pink-400 bg-pink-400/10 border-pink-400/20",
  "Metodologi": "text-fuchsia-400 bg-fuchsia-400/10 border-fuchsia-400/20",
  "Referensi & Klaim": "text-amber-400 bg-amber-400/10 border-amber-400/20",
  "Platform & Tools": "text-teal-400 bg-teal-400/10 border-teal-400/20",
  "Kelengkapan": "text-rose-400 bg-rose-400/10 border-rose-400/20",
};

export default function ConsistencyResult({ result, onReset }: Props) {
  const { sections = [], consistency_score = 0, overall = "", issues = [] } = result;
  const highCount = issues.filter((i) => i.severity === "high").length;
  const mediumCount = issues.filter((i) => i.severity === "medium").length;
  const lowCount = issues.filter((i) => i.severity === "low").length;

  return (
    <div>
      <button
        onClick={onReset}
        className="text-white/30 hover:text-white/60 text-sm mb-8 flex items-center gap-1 transition-colors"
      >
        ← Analisis dokumen lain
      </button>

      {/* Score card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/40 text-xs mb-1 uppercase tracking-widest">Consistency Score</p>
            <div className={`text-6xl font-bold tabular-nums ${scoreColor(consistency_score)}`}>
              {consistency_score}
              <span className="text-2xl text-white/20">/100</span>
            </div>
            <p className={`text-sm mt-1 font-medium ${scoreColor(consistency_score)}`}>
              {scoreLabel(consistency_score)}
            </p>
          </div>
          <div className="flex-1 max-w-xs">
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all duration-1000"
                style={{ width: `${consistency_score}%` }}
              />
            </div>
            <p className="text-white/50 text-sm mt-4 leading-relaxed">{overall}</p>
          </div>
        </div>
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border bg-red-400/10 border-red-400/20 px-4 py-3">
          <p className="text-2xl font-bold text-red-400">{highCount}</p>
          <p className="text-xs text-white/40 mt-0.5">Kritis</p>
        </div>
        <div className="rounded-xl border bg-orange-400/10 border-orange-400/20 px-4 py-3">
          <p className="text-2xl font-bold text-orange-400">{mediumCount}</p>
          <p className="text-xs text-white/40 mt-0.5">Sedang</p>
        </div>
        <div className="rounded-xl border bg-yellow-400/10 border-yellow-400/20 px-4 py-3">
          <p className="text-2xl font-bold text-yellow-400">{lowCount}</p>
          <p className="text-xs text-white/40 mt-0.5">Ringan</p>
        </div>
      </div>

      {/* Sections detected */}
      <div className="mb-6">
        <p className="text-white/40 text-xs uppercase tracking-widest mb-3">
          Bagian Terdeteksi ({sections.length})
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {sections.map((s, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-medium text-violet-400 mb-1">{s.name}</p>
              <p className="text-xs text-white/40 leading-relaxed">{s.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Issues */}
      {issues.length === 0 ? (
        <div className="rounded-2xl border border-green-400/20 bg-green-400/5 px-6 py-8 text-center">
          <p className="text-green-400 text-lg font-medium">✅ Dokumen konsisten!</p>
          <p className="text-white/40 text-sm mt-2">
            Tidak ditemukan inkonsistensi signifikan antar bagian.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-white/40 text-xs uppercase tracking-widest">
            Inkonsistensi Ditemukan ({issues.length})
          </p>
          {issues.map((issue, i) => {
            const cfg = sevConfig[issue.severity];
            const catColor = categoryColors[issue.category] ?? "text-white/40 bg-white/10 border-white/20";

            return (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 px-5 py-4">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-white/20 text-xs tabular-nums">#{i + 1}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${catColor}`}>
                    {issue.category}
                  </span>
                  <span className="text-xs text-white/30">
                    {issue.section_a} ↔ {issue.section_b}
                  </span>
                </div>

                {/* Title */}
                <p className="text-white/80 text-sm font-medium mb-2">{issue.title}</p>

                {/* Description */}
                <p className="text-white/50 text-sm mb-3 leading-relaxed">
                  <span className="text-white/30">Detail: </span>
                  {issue.description}
                </p>

                {/* Suggestion */}
                <div className="bg-green-400/5 border border-green-400/20 rounded-lg px-4 py-3">
                  <p className="text-xs text-green-400/70 mb-1 uppercase tracking-wide">
                    Saran perbaikan
                  </p>
                  <p className="text-green-300 text-sm leading-relaxed">{issue.suggestion}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}