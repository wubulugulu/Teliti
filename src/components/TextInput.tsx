"use client";

import { useRef, useState, useCallback } from "react";

type Props = {
  text: string;
  setText: (v: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  file: File | null;
  setFile: (f: File | null) => void;
};

export default function TextInput({ text, setText, onAnalyze, loading, file, setFile }: Props) {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

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
      // PDF: tidak perlu ekstrak teks di client, langsung kirim file ke API
    } catch (err) {
      console.error(err);
      alert("Gagal membaca file.");
      setFile(null);
    } finally {
      setFileLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }, []);

  const removeFile = () => {
    setFile(null);
    setText("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const isPDF = file?.name.endsWith(".pdf");

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !file && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl px-5 py-8 flex flex-col items-center gap-3 transition-all text-center
          ${file ? "cursor-default border-violet-500/40 bg-violet-500/5" : "cursor-pointer hover:border-violet-500/50 hover:bg-violet-500/5"}
          ${dragging ? "border-violet-500 bg-violet-500/10 scale-[1.01]" : "border-white/20"}`}
      >
        {fileLoading ? (
          <>
            <span className="w-8 h-8 border-2 border-white/20 border-t-violet-400 rounded-full animate-spin block" />
            <p className="text-white/50 text-sm">Membaca file...</p>
          </>
        ) : dragging ? (
          <>
            <span className="text-3xl">📂</span>
            <p className="text-violet-400 text-sm font-medium">Lepas file di sini</p>
          </>
        ) : file ? (
          <>
            <span className="text-3xl">{isPDF ? "📕" : "📄"}</span>
            <div>
              <p className="text-white/80 text-sm font-medium">{file.name}</p>
              <p className="text-xs text-white/40 mt-0.5">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); removeFile(); }}
              className="text-xs text-red-400/70 hover:text-red-400 transition-colors mt-1"
            >
              × Hapus file
            </button>
          </>
        ) : (
          <>
            <span className="text-3xl">📄</span>
            <div>
              <p className="text-white/60 text-sm font-medium">Drag & drop file di sini</p>
              <p className="text-white/30 text-xs mt-1">atau klik untuk pilih · PDF, DOCX, TXT</p>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFile} className="hidden" />
      </div>

      {/* Textarea — sembunyiin kalau ada file PDF */}
      {!isPDF && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-white/20">atau ketik langsung</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste teks lo di sini..."
              className="w-full bg-transparent px-5 pt-5 pb-3 text-white/90 placeholder:text-white/20 resize-none outline-none text-sm leading-relaxed min-h-[200px]"
              rows={8}
            />
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
              <span className="text-xs text-white/20">
                {wordCount > 0 ? `${wordCount} kata` : "Min. 5 kata"}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Tombol analisis */}
      <button
        onClick={onAnalyze}
        disabled={loading || (!file && wordCount < 5)}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Menganalisis...
          </>
        ) : (
          "Analisis Sekarang →"
        )}
      </button>
    </div>
  );
}