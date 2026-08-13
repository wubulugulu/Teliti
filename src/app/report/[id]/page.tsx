import { loadPublicScan } from "@/lib/supabase/history-server";
import { notFound } from "next/navigation";
import { scoreLabel } from "@/lib/scoreLabel";

function scoreColor(score: number) {
  if (score >= 75) return "#16A34A";
  if (score >= 50) return "#D97706";
  return "#DC2626";
}


const sevColor = {
  high: { text: "#DC2626", bg: "#FEE2E2", label: "Tinggi" },
  medium: { text: "#D97706", bg: "#FFFBEB", label: "Sedang" },
  low: { text: "#CA8A04", bg: "#FFFBEB", label: "Rendah" },
};

export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scan = await loadPublicScan(id);

  if (!scan) notFound();

  const biases = scan.biasResult?.biases ?? [];
  const issues = scan.consistencyResult?.issues ?? [];
  const score = scan.integrityScore;

  return (
    <div className="min-h-screen bg-[#f0fdfa]">
      <header className="flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-md border-b border-white/40">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="Teliti" className="h-7" />
         
        </div>
        <a
          href="/"
          className="text-xs px-4 py-1.5 rounded-full bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
        >
          Coba Teliti
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <p className="text-xs text-[#6d7a77] mb-1">Dokumen</p>
        <h1 className="text-xl font-bold text-[#0b1c30] mb-6">{scan.fileName}</h1>

        {score !== null && (
          <div className="rounded-2xl p-6 mb-6 bg-white border border-[#e5eeff]">
            <p className="text-[10px] font-bold text-[#6d7a77] uppercase tracking-widest mb-2">
              Integrity Score
            </p>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-5xl font-bold tabular-nums leading-none" style={{ color: scoreColor(score) }}>
                {score}
              </span>
              <span className="text-lg mb-1 text-[#6d7a77]">/100</span>
              <span className="text-sm font-bold mb-1" style={{ color: scoreColor(score) }}>
                {scoreLabel(score)}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden bg-[#e5eeff]">
              <div
                className="h-full rounded-full"
                style={{ width: `${score}%`, background: scoreColor(score) }}
              />
            </div>
          </div>
        )}

        {scan.biasResult?.summary && (
          <div className="rounded-2xl p-5 mb-4 bg-white border border-[#e5eeff]">
            <p className="text-[10px] font-bold text-[#6d7a77] uppercase tracking-widest mb-1">
              Ringkasan Bias
            </p>
            <p className="text-sm leading-relaxed text-[#3d4947]">{scan.biasResult.summary}</p>
          </div>
        )}

        {biases.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-[#6d7a77] uppercase tracking-widest mb-3">
              Temuan Bias ({biases.length})
            </p>
            <div className="space-y-2">
              {biases.map((bias, i) => {
                const cfg = sevColor[bias.severity];
                return (
                  <div key={i} className="rounded-xl p-4 bg-white border border-[#e5eeff]">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs text-[#6d7a77]">{bias.type}</span>
                    </div>
                    <p className="text-xs italic mb-2 text-[#3d4947]">"{bias.sentence}"</p>
                    <p className="text-xs leading-relaxed text-[#6d7a77]">{bias.explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {issues.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-bold text-[#6d7a77] uppercase tracking-widest mb-3">
              Temuan Inkonsistensi ({issues.length})
            </p>
            <div className="space-y-2">
              {issues.map((issue: any, i: number) => {
                const cfg = sevColor[issue.severity as "low" | "medium" | "high"];
                return (
                  <div key={i} className="rounded-xl p-4 bg-white border border-[#e5eeff]">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: cfg.bg, color: cfg.text }}
                      >
                        {cfg.label}
                      </span>
                      <span className="text-xs text-[#6d7a77]">{issue.category}</span>
                    </div>
                    <p className="text-xs font-semibold mb-1 text-[#0b1c30]">{issue.title}</p>
                    <p className="text-xs leading-relaxed text-[#6d7a77]">{issue.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-[#6d7a77] mt-10">
          Dibuat dengan <a href="/" className="text-teal-600 font-semibold">Teliti</a> 
        </p>
      </main>
    </div>
  );
}