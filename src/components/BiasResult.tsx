"use client";

import { AnalysisResult, BiasItem } from "@/app/page";

type Props = {
  result: AnalysisResult;
  originalText: string;
  onReset: () => void;
};

const severityConfig = {
  low: { label: "Rendah", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  medium: { label: "Sedang", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  high: { label: "Tinggi", color: "text-red-400", bg: "bg-red-400/10 border-red-400/20" },
};

const scoreColor = (score: number) => {
  if (score <= 30) return "text-green-400";
  if (score <= 60) return "text-yellow-400";
  return "text-red-400";
};

const scoreLabel = (score: number) => {
  if (score <= 20) return "Sangat Bersih";
  if (score <= 40) return "Cukup Bersih";
  if (score <= 60) return "Perlu Perhatian";
  if (score <= 80) return "Banyak Bias";
  return "Sangat Bias";
};

export default function BiasResult({ result, originalText, onReset }: Props) {
  const { score, summary, biases } = result;

  return (
    <div>
      {/* Back */}
      <button
        onClick={onReset}
        className="text-white/30 hover:text-white/60 text-sm mb-8 flex items-center gap-1 transition-colors"
      >
        ← Analisis teks lain
      </button>

      {/* Score card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-white/40 text-xs mb-1 uppercase tracking-widest">Bias Score</p>
            <div className={`text-6xl font-bold tabular-nums ${scoreColor(score)}`}>
              {score}
              <span className="text-2xl text-white/20">/100</span>
            </div>
            <p className={`text-sm mt-1 font-medium ${scoreColor(score)}`}>
              {scoreLabel(score)}
            </p>
          </div>
          <div className="flex-1 max-w-xs">
            {/* Score bar */}
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-1000"
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-white/50 text-sm mt-4 leading-relaxed">{summary}</p>
          </div>
        </div>
      </div>

      {/* Bias count */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {(["high", "medium", "low"] as const).map((sev) => {
          const count = biases.filter((b) => b.severity === sev).length;
          const cfg = severityConfig[sev];
          return (
            <div key={sev} className={`rounded-xl border px-4 py-3 ${cfg.bg}`}>
              <p className={`text-2xl font-bold ${cfg.color}`}>{count}</p>
              <p className="text-xs text-white/40 mt-0.5">Bias {cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Bias list */}
      {biases.length === 0 ? (
        <div className="rounded-2xl border border-green-400/20 bg-green-400/5 px-6 py-8 text-center">
          <p className="text-green-400 text-lg font-medium">🎉 Tidak ditemukan bias!</p>
          <p className="text-white/40 text-sm mt-2">Teks lo tergolong netral dan inklusif.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-white/60 text-xs uppercase tracking-widest mb-3">
            Detail Temuan ({biases.length})
          </h2>
          {biases.map((bias, i) => (
            <BiasCard key={i} bias={bias} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function BiasCard({ bias, index }: { bias: BiasItem; index: number }) {
  const cfg = severityConfig[bias.severity];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white/20 text-xs tabular-nums">#{index}</span>
          <span className="text-xs font-medium text-violet-400 bg-violet-400/10 border border-violet-400/20 px-2 py-0.5 rounded-full">
            {bias.type}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
        </div>

        {/* Kalimat */}
        <blockquote className="text-white/80 text-sm italic border-l-2 border-violet-500/50 pl-3 mb-3 leading-relaxed">
          "{bias.sentence}"
        </blockquote>

        {/* Explanation */}
        <p className="text-white/50 text-sm mb-3 leading-relaxed">
          <span className="text-white/30">Mengapa bias: </span>
          {bias.explanation}
        </p>

        {/* Suggestion */}
        <div className="bg-green-400/5 border border-green-400/20 rounded-lg px-4 py-3">
          <p className="text-xs text-green-400/70 mb-1 uppercase tracking-wide">Saran perbaikan</p>
          <p className="text-green-300 text-sm leading-relaxed">{bias.suggestion}</p>
        </div>
      </div>
    </div>
  );
}
