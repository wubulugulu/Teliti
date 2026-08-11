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

  // Build highlight map: sentence → id + type
  const highlights = useMemo(() => {
    const map: { sentence: string; id: string; kind: "bias" | "consistency" }[] = [];
    biases.forEach((b, i) => {
      if (b.sentence) map.push({ sentence: b.sentence, id: `bias-${i}`, kind: "bias" });
    });
    issues.forEach((iss, i) => {
      // For consistency issues we highlight mentions of section names in text
      if (iss.title) map.push({ sentence: iss.title, id: `consistency-${i}`, kind: "consistency" });
    });
    return map;
  }, [biases, issues]);

  // Build highlighted HTML
  const html = useMemo(() => {
    if (!text) return "";

    let result = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Apply highlights from longest to shortest to avoid overlap issues
    const sorted = [...highlights].sort((a, b) => b.sentence.length - a.sentence.length);

    for (const h of sorted) {
      const escaped = escapeRegex(h.sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
      if (!escaped || escaped.length < 5) continue;
      try {
        const regex = new RegExp(escaped, "g");
        const cls = h.kind === "bias" ? "bias-highlight" : "consistency-highlight";
        result = result.replace(
          regex,
          `<mark class="${cls}" data-id="${h.id}">${h.sentence.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</mark>`
        );
      } catch {
        // skip invalid regex
      }
    }

    // Convert newlines to paragraphs
    result = result
      .split(/\n\n+/)
      .map((p) => `<p style="margin-bottom:1rem;line-height:1.75">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    return result;
  }, [text, highlights]);

  // Scroll to active highlight
  useEffect(() => {
    if (!activeHighlight || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-id="${activeHighlight}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Remove active from all, add to this one
      containerRef.current.querySelectorAll(".active").forEach((e) => e.classList.remove("active"));
      el.classList.add("active");
    }
  }, [activeHighlight]);

  // Click handler on marks
  const handleClick = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest("mark[data-id]");
    if (mark) {
      const id = mark.getAttribute("data-id");
      onHighlightClick(id === activeHighlight ? null : id);
    }
  };

  if (!text) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
        <div className="text-center">
          <p className="text-sm">Teks dokumen tidak tersedia</p>
          <p className="text-xs mt-1">PDF mungkin tidak mengandung teks yang bisa diekstrak</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div
        className="flex items-center gap-4 px-6 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <p className="text-xs font-600" style={{ color: "var(--text-muted)" }}>DOKUMEN</p>
        <div className="flex items-center gap-3 ml-auto">
          {biases.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm inline-block" style={{ background: "#FDE047", border: "1px solid #EAB308" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{biases.length} bias</span>
            </div>
          )}
          {issues.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 rounded-sm inline-block" style={{ background: "#FEE2E2", border: "1px solid #EF4444" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{issues.length} inkonsistensi</span>
            </div>
          )}
        </div>
      </div>

      {/* Text body */}
      <div className="flex-1 overflow-y-auto px-10 py-8" ref={containerRef} onClick={handleClick}>
        <div
          className="max-w-2xl mx-auto text-sm"
          style={{ color: "var(--text-primary)", fontFamily: "inherit" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}