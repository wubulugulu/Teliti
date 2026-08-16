"use client";
import type { ScanRecord } from "@/types";
import type { User } from "@supabase/supabase-js";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import ResultPanel from "@/components/ResultPanel";
import DocumentViewer from "@/components/DocumentViewer";
import { saveScan, loadScans } from "@/lib/supabase/history";
import { createClient } from "@/lib/supabase/client";
import { MAX_DOC_CHARS, MAX_FILE_SIZE_BYTES } from "@/lib/constants";

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

  // Profile / auth state
  const [user, setUser] = useState<User | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Cek status login (sama kayak landing page)
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Tutup dropdown user kalau klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    location.href = "/login";
  };

  const displayName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initial = displayName.charAt(0).toUpperCase();

  const ProfileMenu = () => (
    <div ref={userMenuRef} className="relative">
      <button
        onClick={() => setUserMenuOpen((v) => !v)}
        className="flex items-center gap-2.5 pl-2 pr-4 py-1.5 rounded-full bg-white/70 border border-teal-100 hover:bg-white hover:shadow-md transition-all duration-300"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center text-white text-xs font-bold">
            {initial}
          </div>
        )}
        <span className="text-sm font-semibold text-[#0b1c30] max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#6d7a77] transition-transform duration-300 ${userMenuOpen ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-[#e5eeff] overflow-hidden origin-top-right transition-all duration-200 ${userMenuOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
          }`}
      >
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 text-left px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  );

  const processFile = async (f: File) => {
    const isPdfFile = f.name.endsWith(".pdf");

    // Cek raw file size HANYA buat PDF -- itu dikirim mentah ke server
    // (FormData), jadi ukuran file = ukuran payload beneran. Docx/txt
    // diekstrak jadi teks DI CLIENT dulu (lihat di bawah), raw file
    // size-nya gak nyambung sama ukuran payload yang beneran dikirim.
    if (isPdfFile && f.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `Ukuran file PDF maksimal ${(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(1)}MB. File lo ${(f.size / (1024 * 1024)).toFixed(1)}MB.`
      );
      return;
    }

    setFileLoading(true);
    setFile(f);
    setText("");
    setError("");
    try {
      if (f.name.endsWith(".docx") || f.name.endsWith(".doc")) {
        const mammoth = await import("mammoth");
        const arrayBuffer = await f.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        applyExtractedText(result.value);
      } else if (f.name.endsWith(".txt")) {
        applyExtractedText(await f.text());
      }
    } catch {
      setError("Gagal membaca file.");
      setFile(null);
    } finally {
      setFileLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /**
   * Terapkan teks hasil ekstraksi docx/txt ke state, dengan truncate kalau
   * kepanjangan. Ini bukan soal ukuran FILE mentah (itu udah gak relevan
   * buat docx/txt, lihat komentar MAX_FILE_SIZE_BYTES di constants.ts),
   * tapi soal panjang TEKS yang bakal dikirim ke server sebagai JSON body.
   * Server toh bakal truncate ke MAX_DOC_CHARS juga buat analisis Gemini
   * -- truncate di sini nyegah kirim payload gede percuma dan nyegah kena
   * limit ukuran body Vercel buat dokumen yang beneran ekstrem panjangnya.
   */
  const applyExtractedText = (extracted: string) => {
    if (extracted.length > MAX_DOC_CHARS) {
      setText(extracted.slice(0, MAX_DOC_CHARS));
      setError(
        `Dokumen ini punya ${extracted.length.toLocaleString("id")} karakter, ` +
        `dipotong ke ${MAX_DOC_CHARS.toLocaleString("id")} karakter pertama untuk dianalisis ` +
        `(dokumen sangat panjang, hanya bagian awal yang akan dicek).`
      );
    } else {
      setText(extracted);
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
        biasResult: data.bias ?? null,
        consistencyResult: data.consistency ?? null,
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

  // Markup form upload/paste-text -- dipakai di DUA tempat: full landing
  // (user baru, belum punya history sama sekali) dan inline di dalam app
  // shell (user klik "New Analysis" saat sudah punya history). Ekstrak
  // jadi fungsi lokal supaya gak duplikat, bukan komponen terpisah biar
  // gak perlu prop-drilling banyak state.
  const renderUploadForm = () => (
    <>
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
            <p className="text-xs text-[#6d7a77]">
              PDF (maks. {(MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(1)}MB) · DOCX, TXT (tanpa batas ukuran file, teks panjang otomatis dipotong)
            </p>
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
    </>
  );

  // ── FULL LANDING (user baru, belum pernah scan sama sekali) ─────────
  // Ini SATU-SATUNYA kondisi yang masih full-page tanpa sidebar. Begitu
  // history.length > 0, "New Analysis" gak akan pernah masuk ke sini lagi
  // -- lihat app shell di bawah.
  if (stage === "input" && history.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f0fdfa]">
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-teal-200/30 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-blue-200/30 rounded-full blur-[100px]" />
        </div>

        <header className="relative z-10 flex items-center justify-between px-8 py-4 bg-white/60 backdrop-blur-md border-b border-white/40">
          <div
            onClick={() => router.push("/")}
            className="flex items-center cursor-pointer"
          >
            <img src="/logo.svg" alt="Teliti" className="h-8" />
          </div>
          <ProfileMenu />
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

            {renderUploadForm()}

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

  // ── APP SHELL (user sudah punya history) ─────────────────────────────
  // Sidebar & header SELALU render di sini, baik lagi liat hasil
  // (stage === "result") maupun lagi mulai analisis baru
  // (stage === "input" setelah klik "New Analysis"). Cuma konten tengah
  // yang ganti.
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
            className="flex items-center cursor-pointer"
          >
            <img src="/logo.svg" alt="Teliti" className="h-6" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProfileMenu />
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
                  onClick={() => { setActiveScan(record); setActiveHighlight(null); setStage("result"); }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${activeScan?.id === record.id && stage === "result"
                    ? "bg-teal-50 border border-teal-200"
                    : "hover:bg-[#f0fdfa]"
                    }`}
                >
                  <p className={`text-xs font-medium truncate mb-0.5 ${activeScan?.id === record.id && stage === "result" ? "text-teal-700" : "text-[#0b1c30]"}`}>
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

        {stage === "result" && activeScan ? (
          <>
            <div className="flex-1 overflow-hidden flex flex-col bg-white/50">
              <DocumentViewer
                text={activeScan.documentText}
                biases={activeScan.biasResult?.biases ?? []}
                issues={activeScan.consistencyResult?.issues ?? []}
                activeHighlight={activeHighlight}
                onHighlightClick={setActiveHighlight}
              />
            </div>

            <div className="w-96 flex-shrink-0 border-l border-[#e5eeff] overflow-y-auto bg-white/70">
              <ResultPanel
                scan={activeScan}
                activeHighlight={activeHighlight}
                onHighlightSelect={setActiveHighlight}
              />
            </div>
          </>
        ) : (
          // stage === "input" tapi history.length > 0 -- "New Analysis"
          // diklik dari dalam app. Sidebar tetap ada, panel tengah ganti
          // jadi form upload/paste-text, panel kanan (ResultPanel)
          // disembunyikan karena belum ada hasil buat ditampilin.
          <div className="flex-1 overflow-y-auto bg-white/50 flex justify-center px-6 py-10">
            <div className="w-full max-w-xl">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#0b1c30] mb-1">Analisis Baru</h2>
                <p className="text-sm text-[#6d7a77]">
                  Upload dokumen atau paste teks buat dicek bias dan konsistensinya.
                </p>
              </div>
              {renderUploadForm()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}