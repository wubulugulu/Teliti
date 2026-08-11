"use client";

import { useState, useRef, useCallback } from "react";
import ResultPanel from "@/components/ResultPanel";
import DocumentViewer from "@/components/DocumentViewer";

export type BiasItem = {
  sentence: string;
  type: string;
  severity: "low" | "medium" | "high";
  explanation: string;
  suggestion: string;
};

export type AnalysisResult = {
  score: number;
  summary: string;
  biases: BiasItem[];
};

export type ScanRecord = {
  id: string;
  fileName: string;
  timestamp: Date;
  integrityScore: number | null;
  biasResult: AnalysisResult | null;
  consistencyResult: any | null;
  documentText: string;
};

export default function Home() {
  const [stage, setStage] = useState<"input" | "result">("input");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [activeScan, setActiveScan] = useState<ScanRecord | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (f: File) => {
    setFileLoading(true);
    setFile(f);
    setText("");
    try {
      if (f.name.endsWith(".docx") || f.name.endsWith(".doc")) {
        const mammoth = await import("mammoth");
        const arrayBuffer = await f.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setText(result.value);
      } else if (f.name.endsWith(".txt")) {
        setText(await f.text());
      }
      // PDF: dikirim langsung ke API
    } catch {
      setError("Gagal membaca file.");
      setFile(null);
    } finally {
      setFileLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }, []);

  const scan = async () => {
    if (!file && !text.trim()) return;
    setLoading(true);
    setError("");

    try {
      let docText = text;
      let data: any;

      if (file?.name.endsWith(".pdf")) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/integrity-check", { method: "POST", body: formData });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menganalisis");
        // Tampilkan teks dari PDF jika ada — untuk highlight
        docText = data.documentText || "";
      } else {
        const res = await fetch("/api/integrity-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal menganalisis");
      }

      const record: ScanRecord = {
        id: Date.now().toString(),
        fileName: file?.name || "Teks langsung",
        timestamp: new Date(),
        integrityScore: data.integrityScore ?? null,
        biasResult: data.biasResult ?? null,
        consistencyResult: data.consistencyResult ?? null,
        documentText: docText,
      };

      setHistory((prev) => [record, ...prev]);
      setActiveScan(record);
      setStage("result");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStage("input");
    setText("");
    setFile(null);
    setError("");
    setActiveHighlight(null);
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isPDF = file?.name.endsWith(".pdf");
  const canScan = !loading && (!!file || wordCount >= 5);

  // ── INPUT STAGE ──────────────────────────────────────────────────
  if (stage === "input") {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
        {/* Header */}
        <header
          className="flex items-center justify-between px-8 py-4 border-b"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-700 tracking-tight" style={{ color: "var(--text-primary)" }}>
              teliti
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-500"
              style={{ background: "var(--teal-light)", color: "var(--teal-dark)" }}
            >
              beta
            </span>
          </div>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            ITFest 6.0 · Universitas Paramadina
          </span>
        </header>

        {/* Main */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl">
            {/* Hero */}
            <div className="mb-10 text-center">
              <h1
                className="text-4xl font-700 tracking-tight mb-3 leading-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Dokumen lo sudah{" "}
                <span style={{ color: "var(--teal)" }}>teliti</span>?
              </h1>
              <p className="text-base" style={{ color: "var(--text-secondary)" }}>
                Cek bias dan konsistensi skripsi, paper, atau teks akademik lo — sekaligus, satu scan.
              </p>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => !file && fileRef.current?.click()}
              className="rounded-2xl border-2 border-dashed transition-all mb-4"
              style={{
                borderColor: dragging ? "var(--teal)" : file ? "var(--teal)" : "var(--border-strong)",
                background: dragging ? "var(--teal-bg)" : file ? "var(--teal-bg)" : "var(--bg-card)",
                cursor: file ? "default" : "pointer",
                padding: "28px",
              }}
            >
              {fileLoading ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--border-strong)", borderTopColor: "var(--teal)" }}
                  />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Membaca file...</p>
                </div>
              ) : file ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                      style={{ background: "var(--teal-light)" }}
                    >
                      {isPDF ? "📕" : "📄"}
                    </div>
                    <div>
                      <p className="text-sm font-600" style={{ color: "var(--text-primary)" }}>{file.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setText(""); }}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--red)", background: "var(--red-bg)" }}
                  >
                    Hapus
                  </button>
                </div>
              ) : dragging ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <p className="text-sm font-600" style={{ color: "var(--teal)" }}>Lepas file di sini</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
                    style={{ background: "var(--bg-hover)" }}
                  >
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                      <path d="M12 4v12m0-12L8 8m4-4l4 4" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="var(--text-secondary)" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="text-sm font-500" style={{ color: "var(--text-primary)" }}>
                    Drag & drop atau <span style={{ color: "var(--teal)" }}>pilih file</span>
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>PDF, DOCX, TXT</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} className="hidden" />
            </div>

            {/* Divider */}
            {!isPDF && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>atau ketik langsung</span>
                  <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
                </div>

                <div
                  className="rounded-2xl border overflow-hidden mb-4"
                  style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
                >
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste teks di sini..."
                    className="w-full px-5 pt-5 pb-3 resize-none outline-none text-sm leading-relaxed"
                    style={{
                      background: "transparent",
                      color: "var(--text-primary)",
                      minHeight: "180px",
                      fontFamily: "inherit",
                    }}
                    rows={7}
                  />
                  <div
                    className="flex items-center justify-between px-5 py-3 border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {wordCount > 0 ? `${wordCount} kata` : "Min. 5 kata"}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div
                className="rounded-xl px-4 py-3 mb-4 text-sm"
                style={{ background: "var(--red-bg)", color: "var(--red)" }}
              >
                {error}
              </div>
            )}

            {/* Scan button */}
            <button
              onClick={scan}
              disabled={!canScan}
              className="w-full py-3.5 rounded-xl text-sm font-600 transition-all flex items-center justify-center gap-2"
              style={{
                background: canScan ? "var(--teal)" : "var(--border)",
                color: canScan ? "#fff" : "var(--text-muted)",
                cursor: canScan ? "pointer" : "not-allowed",
              }}
            >
              {loading ? (
                <>
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                  />
                  Menganalisis...
                </>
              ) : (
                "Scan Dokumen"
              )}
            </button>

            {/* What we check */}
            <div className="mt-8 grid grid-cols-2 gap-2">
              {[
                { label: "Deteksi Bias", desc: "Gender, usia, ras, konfirmasi, dll" },
                { label: "Cek Konsistensi", desc: "Tujuan, metode, hasil, kesimpulan" },
                { label: "Highlight Teks", desc: "Tandai bagian bermasalah langsung" },
                { label: "Saran Perbaikan", desc: "Rekomendasi kalimat yang lebih baik" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl px-4 py-3 border"
                  style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
                >
                  <p className="text-xs font-600 mb-0.5" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── RESULT STAGE ──────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
            title="Toggle sidebar"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
              <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="text-base font-700 tracking-tight" style={{ color: "var(--text-primary)" }}>teliti</span>
        </div>
        <button
          onClick={reset}
          className="text-xs px-3 py-1.5 rounded-lg font-500 transition-colors"
          style={{ background: "var(--bg-hover)", color: "var(--text-secondary)" }}
        >
          + Scan baru
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar history */}
        {sidebarOpen && (
          <aside
            className="w-56 flex-shrink-0 border-r flex flex-col overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-600" style={{ color: "var(--text-muted)" }}>RIWAYAT SCAN</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {history.map((record) => (
                <button
                  key={record.id}
                  onClick={() => { setActiveScan(record); setActiveHighlight(null); }}
                  className="w-full text-left px-4 py-3 transition-colors"
                  style={{
                    background: activeScan?.id === record.id ? "var(--teal-bg)" : "transparent",
                    borderLeft: activeScan?.id === record.id ? "2px solid var(--teal)" : "2px solid transparent",
                  }}
                >
                  <p
                    className="text-xs font-500 truncate mb-0.5"
                    style={{ color: activeScan?.id === record.id ? "var(--teal-dark)" : "var(--text-primary)" }}
                  >
                    {record.fileName}
                  </p>
                  <div className="flex items-center gap-2">
                    {record.integrityScore !== null && (
                      <span
                        className="text-xs font-600"
                        style={{ color: record.integrityScore >= 75 ? "var(--green)" : record.integrityScore >= 50 ? "var(--amber)" : "var(--red)" }}
                      >
                        {record.integrityScore}/100
                      </span>
                    )}
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {record.timestamp.toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Document viewer */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeScan && (
            <DocumentViewer
              text={activeScan.documentText}
              biases={activeScan.biasResult?.biases ?? []}
              issues={activeScan.consistencyResult?.issues ?? []}
              activeHighlight={activeHighlight}
              onHighlightClick={setActiveHighlight}
            />
          )}
        </div>

        {/* Result panel */}
        <div
          className="w-96 flex-shrink-0 border-l overflow-y-auto"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          {activeScan && (
            <ResultPanel
              scan={activeScan}
              activeHighlight={activeHighlight}
              onHighlightSelect={setActiveHighlight}
            />
          )}
        </div>
      </div>
    </div>
  );
}