"use client";
import type { ScanRecord } from "@/types";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import ResultPanel from "@/components/ResultPanel";
import DocumentViewer from "@/components/DocumentViewer";
import { saveScan, loadScans } from "@/lib/supabase/history";
import { createClient } from "@/lib/supabase/client";

export default function Home() {
  const router = useRouter();
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

  // Load history dari Supabase saat mount
  useEffect(() => {
    loadScans().then((scans) => {
      setHistory(scans);
      if (scans.length > 0) {
        setActiveScan(scans[0]);
        setStage("result");
      }
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    location.href = "/login";
  };

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

      // Simpan ke Supabase
      const saved = await saveScan(record);
      if (saved) record.id = saved.id;

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
      <div className="min-h-screen flex flex-col bg-[#f0fdfa]">
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-teal-200/30 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-blue-200/30 rounded-full blur-[100px]" />
        </div>

        <header className="relative z-10 flex items-center justify-between px-8 py-4 bg-white/60 backdrop-blur-md border-b border-white/40">
          <div
            onClick={() => router.push("/")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center text-white text-xs font-bold">T</div>
            <span className="text-lg font-bold tracking-tight text-[#0b1c30]">Teliti</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700 border border-teal-100">beta</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs px-4 py-1.5 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 hover:shadow-[0_4px_14px_rgba(239,68,68,0.35)] transition-all"
          >
            Keluar
          </button>
        </header>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16">
          <div className="w-full max-w-2xl">
            <div className="mb-10 text-center">
              <h1 className="text-4xl font-extrabold tracking-tight mb-3 leading-tight text-[#0b1c30]">
                Dokumen lo sudah{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-400">teliti</span>?
              </h1>
              <p className="text-base text-[#3d4947]">
                Cek bias dan konsistensi skripsi, paper, atau teks akademik lo sekaligus, satu scan.
              </p>
            </div>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onClick={() => !file && fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed transition-all mb-4 p-7 ${dragging ? "border-teal-500 bg-teal-50"
                : file ? "border-teal-400 bg-teal-50/50"
                  : "border-[#bcc9c6] bg-white/70 hover:border-teal-300 hover:bg-white/90 cursor-pointer"
                }`}
            >
              {fileLoading ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-8 h-8 rounded-full border-2 border-teal-200 border-t-teal-600 animate-spin" />
                  <p className="text-sm text-[#6d7a77]">Membaca file...</p>
                </div>
              ) : file ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg bg-teal-100">
                      {isPDF ? "📕" : "📄"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0b1c30]">{file.name}</p>
                      <p className="text-xs mt-0.5 text-[#6d7a77]">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setText(""); }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                  >
                    Hapus
                  </button>
                </div>
              ) : dragging ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <p className="text-sm font-semibold text-teal-600">Lepas file di sini</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center mb-1">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                      <path d="M12 4v12m0-12L8 8m4-4l4 4" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="#0d9488" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-[#0b1c30]">
                    Drag & drop atau <span className="text-teal-600">pilih file</span>
                  </p>
                  <p className="text-xs text-[#6d7a77]">PDF, DOCX, TXT · Maks. 10MB</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} className="hidden" />
            </div>

            {!isPDF && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-[#bcc9c6]" />
                  <span className="text-xs text-[#6d7a77]">atau ketik langsung</span>
                  <div className="flex-1 h-px bg-[#bcc9c6]" />
                </div>
                <div className="rounded-2xl border border-[#bcc9c6] bg-white/80 overflow-hidden mb-4">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste teks di sini..."
                    className="w-full px-5 pt-5 pb-3 resize-none outline-none text-sm leading-relaxed bg-transparent text-[#0b1c30] placeholder:text-[#6d7a77]"
                    style={{ minHeight: "180px", fontFamily: "inherit" }}
                    rows={7}
                  />
                  <div className="flex items-center justify-between px-5 py-3 border-t border-[#e5eeff]">
                    <span className="text-xs text-[#6d7a77]">
                      {wordCount > 0 ? `${wordCount} kata` : "Min. 5 kata"}
                    </span>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="rounded-xl px-4 py-3 mb-4 text-sm bg-red-50 text-red-600 border border-red-100">
                {error}
              </div>
            )}

            <button
              onClick={scan}
              disabled={!canScan}
              className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${canScan
                ? "bg-teal-600 text-white hover:bg-teal-700 hover:shadow-[0_4px_20px_rgba(13,148,136,0.3)]"
                : "bg-[#e5eeff] text-[#6d7a77] cursor-not-allowed"
                }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Menganalisis...
                </>
              ) : "Scan Dokumen"}
            </button>

            <div className="mt-8 grid grid-cols-2 gap-2">
              {[
                { label: "Deteksi Bias", desc: "Gender, usia, ras, konfirmasi, dll" },
                { label: "Cek Konsistensi", desc: "Tujuan, metode, hasil, kesimpulan" },
                { label: "Highlight Teks", desc: "Tandai bagian bermasalah langsung" },
                { label: "Saran Perbaikan", desc: "Rekomendasi kalimat yang lebih baik" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl px-4 py-3 border border-[#e5eeff] bg-white/70">
                  <p className="text-xs font-semibold mb-0.5 text-[#0b1c30]">{item.label}</p>
                  <p className="text-xs text-[#6d7a77]">{item.desc}</p>
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
    <div className="h-screen flex flex-col overflow-hidden bg-[#f0fdfa]">
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#e5eeff] bg-white/80 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg text-[#3d4947] hover:bg-teal-50 transition-colors"
          >
            <svg
              width="18" height="18" fill="none" viewBox="0 0 24 24"
              className={`transition-transform duration-300 ease-in-out ${sidebarOpen ? "rotate-0" : "rotate-180"}`}
            >
              <path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <div
            onClick={() => router.push("/")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center text-white text-xs font-bold">T</div>
            <span className="text-base font-bold tracking-tight text-[#0b1c30]">Teliti</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="text-xs px-4 py-1.5 rounded-full bg-red-500 text-white font-semibold hover:bg-red-600 hover:shadow-[0_4px_14px_rgba(239,68,68,0.35)] transition-all"
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <aside className="w-60 flex-shrink-0 border-r border-[#e5eeff] bg-white/70 flex flex-col overflow-hidden">
            <div className="px-4 py-4 border-b border-[#e5eeff]">
              <p className="text-[10px] font-bold text-[#6d7a77] uppercase tracking-widest mb-3">Scan History</p>
              <button
                onClick={reset}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors"
              >
                <span>+</span> New Analysis
              </button>
            </div>

            <div className="px-3 py-2">
              <p className="text-[10px] font-semibold text-[#6d7a77] uppercase tracking-widest px-1 mb-1">Last 30 Days</p>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
              {history.map((record) => (
                <button
                  key={record.id}
                  onClick={() => { setActiveScan(record); setActiveHighlight(null); }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${activeScan?.id === record.id
                    ? "bg-teal-50 border border-teal-200"
                    : "hover:bg-[#f0fdfa]"
                    }`}
                >
                  <p className={`text-xs font-medium truncate mb-0.5 ${activeScan?.id === record.id ? "text-teal-700" : "text-[#0b1c30]"}`}>
                    {record.fileName}
                  </p>
                  <div className="flex items-center gap-2">
                    {record.integrityScore !== null && (
                      <span className={`text-xs font-bold ${record.integrityScore >= 75 ? "text-teal-600" : record.integrityScore >= 50 ? "text-amber-500" : "text-red-500"
                        }`}>
                        {record.integrityScore}/100
                      </span>
                    )}
                    <span className="text-xs text-[#6d7a77]">
                      {record.timestamp.toLocaleTimeString("id", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            
          </aside>
        )}

        <div className="flex-1 overflow-hidden flex flex-col bg-white/50">
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

        <div className="w-96 flex-shrink-0 border-l border-[#e5eeff] overflow-y-auto bg-white/70">
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