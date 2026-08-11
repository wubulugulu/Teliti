"use client";

import { useEffect, useRef, useMemo } from "react";
import type { BiasItem } from "@/types";

type Issue = {
  title: string;
  severity: "low" | "medium" | "high";
  description: string;
  suggestion: string;
  section_a: string;
  section_b: string;
  category: string;
};

type Props = {
  text: string;
  biases: BiasItem[];
  issues: Issue[];
  activeHighlight: string | null;
  onHighlightClick: (id: string | null) => void;
};

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function DocumentViewer({ text, biases, issues, activeHighlight, onHighlightClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const highlights = useMemo(() => {
    const map: { sentence: string; id: string; kind: "bias" | "consistency" }[] = [];
    biases.forEach((b, i) => {
      if (b.sentence) map.push({ sentence: b.sentence, id: `bias-${i}`, kind: "bias" });
    });
    return map;
  }, [biases, issues]);

  const html = useMemo(() => {
    if (!text) return "";

    let result = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const sorted = [...highlights].sort((a, b) => b.sentence.length - a.sentence.length);
    console.log("highlights to match:", sorted.map(h => ({ id: h.id, sentence: h.sentence.slice(0, 80) })));
    console.log("text sample:", result.slice(0, 300));
    for (const h of sorted) {
      const escaped = escapeRegex(
        h.sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      );
      if (!escaped || escaped.length < 5) continue;
      try {
        const regex = new RegExp(escaped, "g");
        const cls = h.kind === "bias" ? "teliti-bias-highlight" : "teliti-consistency-highlight";
        const safeInner = h.sentence
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        result = result.replace(
          regex,
          `<mark class="${cls}" data-id="${h.id}">${safeInner}</mark>`
        );
      } catch {
        // skip invalid regex
      }
    }

    result = result
      .split(/\n\n+/)
      .map((p) => `<p style="margin-bottom:1rem;line-height:1.75">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    return result;
  }, [text, highlights]);

  useEffect(() => {
    if (!activeHighlight || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-id="${activeHighlight}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      containerRef.current.querySelectorAll(".teliti-active").forEach((e) => e.classList.remove("teliti-active"));
      el.classList.add("teliti-active");
    }
  }, [activeHighlight]);

  const handleClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest("mark[data-id]");
    if (mark) {
      const id = mark.getAttribute("data-id");
      onHighlightClick(id === activeHighlight ? null : id);
    }
  };

  if (!text) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#6d7a77]">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#e5eeff] flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="#6d7a77" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#0b1c30]">Teks dokumen tidak tersedia</p>
          <p className="text-xs mt-1 text-[#6d7a77]">PDF mungkin tidak mengandung teks yang bisa diekstrak</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Inject highlight styles */}
      <style>{`
        .teliti-bias-highlight {
          background: #FDE047;
          border-radius: 3px;
          padding: 0 2px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .teliti-bias-highlight:hover,
        .teliti-bias-highlight.teliti-active {
          background: #EAB308;
          outline: 2px solid #CA8A04;
          outline-offset: 1px;
        }
        .teliti-consistency-highlight {
          background: #FEE2E2;
          border-radius: 3px;
          padding: 0 2px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .teliti-consistency-highlight:hover,
        .teliti-consistency-highlight.teliti-active {
          background: #FECACA;
          outline: 2px solid #EF4444;
          outline-offset: 1px;
        }
      `}</style>

      <div className="flex flex-col h-full overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-4 px-6 py-2.5 border-b border-[#e5eeff] bg-white/80 backdrop-blur-sm flex-shrink-0">
          <p className="text-xs font-semibold text-[#6d7a77] uppercase tracking-widest">Dokumen</p>
          <div className="flex items-center gap-4 ml-auto">
            {biases.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm inline-block bg-yellow-300 border border-yellow-500" />
                <span className="text-xs text-[#6d7a77]">{biases.length} bias</span>
              </div>
            )}
            {issues.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm inline-block bg-red-100 border border-red-400" />
                <span className="text-xs text-[#6d7a77]">{issues.length} inkonsistensi</span>
              </div>
            )}
          </div>
        </div>

        {/* Text body */}
        <div
          className="flex-1 overflow-y-auto px-10 py-8 bg-white/40"
          ref={containerRef}
          onClick={handleClick}
        >
          <div
            className="max-w-2xl mx-auto text-sm text-[#0b1c30] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </>
  );
}