"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { BiasItem, AnalysisResult, ScanRecord } from "@/types";
import {
  FileText,
  Bot,
  Sparkles,
  Search,
  BarChart3,
  ClipboardList,
  TrendingUp,
  GraduationCap,
  ScrollText,
  ChevronDown,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "fitur", label: "Fitur" },
  { id: "cara-kerja", label: "Cara Kerja" },
  { id: "faq", label: "FAQ" },
];

export default function LandingPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("fitur");
  const navRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const navContainerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const [user, setUser] = useState<User | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Cek status login
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
    setUser(null);
    setUserMenuOpen(false);
    router.push("/");
  };

  const handleCtaClick = () => {
    router.push(user ? "/analyze" : "/login");
  };

  const displayName =
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const initial = displayName.charAt(0).toUpperCase();

  // Scroll spy: pantau section mana yang lagi kelihatan, update state activeSection
  useEffect(() => {
    const sections = NAV_ITEMS.map((n) => document.getElementById(n.id)).filter(
      (el): el is HTMLElement => !!el
    );

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Update posisi garis bawah tiap activeSection berubah
  useEffect(() => {
    const el = navRefs.current[activeSection];
    const container = navContainerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({
        left: elRect.left - containerRect.left,
        width: elRect.width,
        opacity: 1,
      });
    }
  }, [activeSection]);

  const scrollToSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 90;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="bg-[#f0fdfa] text-[#0b1c30] font-sans antialiased min-h-screen flex flex-col relative overflow-x-hidden">

      {/* Background Blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-teal-200/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70" />
        <div className="absolute top-[20%] right-[-10%] w-[40vw] h-[40vw] bg-blue-200/40 rounded-full mix-blend-multiply filter blur-[100px] opacity-70" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] bg-teal-100/40 rounded-full mix-blend-multiply filter blur-[120px] opacity-60" />
      </div>

      {/* Navbar */}
      <header className="fixed top-0 w-full z-50 bg-white/60 backdrop-blur-md border-b border-white/30">
        <nav className="flex justify-between items-center h-24 max-w-[1120px] mx-auto px-8">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Teliti" className="h-8" />
          </div>

          <div ref={navContainerRef} className="hidden md:flex gap-10 relative">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                ref={(el) => { navRefs.current[item.id] = el; }}
                href={`#${item.id}`}
                onClick={scrollToSection(item.id)}
                className={`text-sm font-semibold pb-1 transition-colors duration-300 ${
                  activeSection === item.id
                    ? "text-teal-600"
                    : "text-[#3d4947] hover:text-teal-600"
                }`}
              >
                {item.label}
              </a>
            ))}
            {/* Sliding underline indicator */}
            <span
              className="absolute -bottom-0 h-0.5 bg-teal-600 rounded-full transition-all duration-300 ease-out"
              style={{
                left: indicator.left,
                width: indicator.width,
                opacity: indicator.opacity,
              }}
            />
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div ref={userMenuRef} className="relative hidden md:block">
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
                  className={`absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-[#e5eeff] overflow-hidden origin-top-right transition-all duration-200 ${
                    userMenuOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                  }`}
                >
                  <button
                    onClick={() => { setUserMenuOpen(false); router.push("/analyze"); }}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-[#0b1c30] hover:bg-teal-50 transition-colors"
                  >
                    Buka Dashboard
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 text-left px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors border-t border-[#f0fdfa]"
                  >
                    <LogOut className="w-4 h-4" />
                    Keluar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleCtaClick}
                className="hidden md:block text-sm font-semibold bg-teal-600 text-white px-6 py-2.5 rounded-full hover:bg-teal-700 hover:shadow-[0_0_20px_rgba(13,148,136,0.35)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 min-h-[44px]"
              >
                Coba Gratis
              </button>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-grow pt-24 relative z-10">

        {/* Hero */}
        <section className="max-w-[1120px] mx-auto px-6 py-24 md:py-32 grid md:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col items-start">
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-[#0b1c30]">
              Analisis Dokumen dengan{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-400">
                Teliti
              </span>
            </h1>
            <p className="text-lg text-[#3d4947] mb-10 max-w-lg leading-relaxed">
              Deteksi bias tersembunyi <em>dan</em> periksa konsistensi dokumen penelitian lo dalam satu kali upload. Hasil instan, saran konkret.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleCtaClick}
                className="bg-teal-600 text-white text-sm font-semibold px-8 py-4 rounded-full hover:bg-teal-700 hover:shadow-[0_8px_30px_rgba(13,148,136,0.3)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 min-h-[44px]"
              >
                Mulai Analisis 
              </button>
              <a
                href="#cara-kerja"
                onClick={scrollToSection("cara-kerja")}
                className="bg-white/70 border border-teal-200 text-teal-700 text-sm font-semibold px-8 py-4 rounded-full hover:bg-white hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all duration-300 min-h-[44px] text-center"
              >
                Lihat Cara Kerja
              </a>
            </div>

            {/* Stats */}
            <div className="mt-12 flex gap-8">
              {[
                { val: "2 Fitur", label: "dalam 1 analisis" },
                { val: "3 Format", label: "PDF, DOCX, TXT" },
                { val: "~16 dtk", label: "rata-rata hasil" },
              ].map((s) => (
                <div key={s.val}>
                  <div className="text-xl font-bold text-teal-600">{s.val}</div>
                  <div className="text-xs text-[#6d7a77] mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Visual */}
          <div className="relative hidden md:flex items-center justify-center">
            <div className="absolute inset-0 bg-teal-400/10 rounded-full blur-3xl" />
            <div className="relative bg-white/70 backdrop-blur-sm border border-white/60 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] w-full max-w-sm">
              {/* Mock result card */}
              <div className="flex items-center gap-3 mb-5">
                <img src="/logo-T.svg" alt="Teliti" className="w-8 h-8" />
                <div>
                  <div className="text-sm font-bold text-[#0b1c30]">Skripsi_Final.pdf</div>
                  <div className="text-xs text-[#6d7a77]">Analisis selesai · 8 detik</div>
                </div>
                <div className="ml-auto w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
              </div>

              <div className="space-y-3">
                {/* Integrity Score */}
                <div className="bg-teal-50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-teal-700">Integrity Score</span>
                    <span className="text-xl font-bold text-teal-600">72</span>
                  </div>
                  <div className="h-2 bg-teal-100 rounded-full overflow-hidden">
                    <div className="h-full w-[72%] bg-gradient-to-r from-teal-500 to-teal-400 rounded-full" />
                  </div>
                </div>

                {/* Issues */}
                <div className="space-y-2">
                  {[
                    { label: "Gender Bias", sev: "high", color: "bg-red-100 text-red-600" },
                    { label: "Inkonsistensi Bab III", sev: "medium", color: "bg-amber-100 text-amber-600" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.color}`}>{item.sev}</span>
                      <span className="text-xs text-[#0b1c30] font-medium">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cara Kerja */}
        <section id="cara-kerja" className="py-24 relative scroll-mt-24">
          <div className="max-w-[1120px] mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-[#0b1c30] mb-4">Cara Kerja Teliti</h2>
            <p className="text-lg text-[#3d4947] max-w-2xl mx-auto mb-16">
              Tiga langkah satu upload, dua hasil analisis.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-1/3 left-[18%] right-[18%] h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent z-0" />
              {[
                { step: "1", title: "Unggah Dokumen", desc: "Upload PDF, DOCX, atau tempel teks langsung. Maksimal 10MB.", Icon: FileText },
                { step: "2", title: "AI Menganalisis", desc: "Gemini AI bekerja paralel deteksi bias + cek konsistensi sekaligus.", Icon: Bot },
                { step: "3", title: "Terima Insight", desc: "Hasil lengkap: score, temuan per kategori, dan saran perbaikan konkret.", Icon: Sparkles },
              ].map((item) => (
                <div key={item.step} className="relative z-10 bg-white/70 backdrop-blur-sm border border-white/60 p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_rgba(13,148,136,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center mb-5 shadow-inner">
                    <item.Icon className="w-7 h-7 text-teal-600" strokeWidth={1.75} />
                  </div>
                  <div className="text-xs font-bold text-teal-500 mb-1">Langkah {item.step}</div>
                  <h4 className="text-lg font-bold text-[#0b1c30] mb-2">{item.title}</h4>
                  <p className="text-sm text-[#3d4947] text-center leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fitur */}
        <section id="fitur" className="py-20 scroll-mt-24">
          <div className="max-w-[1120px] mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight text-[#0b1c30] mb-4">Dua Fitur, Satu Analisis</h2>
              <p className="text-lg text-[#3d4947] max-w-xl mx-auto">Sekarang lo gak perlu pilih keduanya jalan otomatis.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  Icon: Search,
                  badge: "Deteksi Bias",
                  title: "Bias yang Tak Terlihat",
                  desc: "Identifikasi gender bias, age bias, socioeconomic bias, cultural bias, dan lainnya lengkap dengan score per temuan dan saran perbaikan kalimat.",
                  tags: ["Gender", "Usia", "Budaya", "Rasial", "Konfirmasi"],
                },
                {
                  Icon: BarChart3,
                  badge: "Cek Konsistensi",
                  title: "Keselarasan Antar Bab",
                  desc: "Pastikan Tujuan, Metode, Hasil, dan Kesimpulan saling mendukung. AI deteksi inkonsistensi logis, angka, terminologi, dan klaim referensi.",
                  tags: ["Logika", "Data & Angka", "Metodologi", "Terminologi"],
                },
              ].map((f) => (
                <div key={f.badge} className="bg-white/70 backdrop-blur-sm border border-white/60 p-10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_rgba(13,148,136,0.12)] hover:-translate-y-1 transition-all duration-300">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-5">
                    <f.Icon className="w-6 h-6 text-teal-600" strokeWidth={1.75} />
                  </div>
                  <span className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-2 block">{f.badge}</span>
                  <h3 className="text-2xl font-bold text-[#0b1c30] mb-3">{f.title}</h3>
                  <p className="text-base text-[#3d4947] leading-relaxed mb-5">{f.desc}</p>
                  <div className="flex flex-wrap gap-2">
                    {f.tags.map((t) => (
                      <span key={t} className="text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-100 px-3 py-1 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cakupan Dokumen */}
        <section className="py-20 relative">
          <div className="max-w-[1120px] mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold tracking-tight text-[#0b1c30] mb-4">Cakupan Dokumen</h2>
              <p className="text-lg text-[#3d4947] max-w-xl mx-auto">Teliti paham berbagai jenis dokumen formal dan akademis.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { Icon: ClipboardList, label: "Proposal Bisnis" },
                { Icon: TrendingUp, label: "Laporan Tahunan" },
                { Icon: GraduationCap, label: "Karya Ilmiah" },
                { Icon: ScrollText, label: "Naskah Kebijakan" },
              ].map((d) => (
                <div key={d.label} className="bg-white/70 backdrop-blur-sm border border-white/60 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 text-center hover:shadow-[0_0_20px_rgba(13,148,136,0.15)] hover:-translate-y-0.5 transition-all duration-300 group">
                  <span className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <d.Icon className="w-5 h-5 text-teal-600" strokeWidth={1.75} />
                  </span>
                  <span className="text-sm font-semibold text-[#0b1c30]">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 scroll-mt-24">
          <div className="max-w-[800px] mx-auto px-6">
            <h2 className="text-4xl font-bold tracking-tight text-[#0b1c30] mb-12 text-center">Pertanyaan Umum</h2>
            <div className="space-y-3">
              {[
                { q: "Apakah data saya aman?", a: "Ya. Dokumen tidak disimpan di server setelah analisis selesai. Teks hanya dikirim ke API AI untuk diproses, tidak disimpan permanen." },
                { q: "Format file apa saja yang didukung?", a: "PDF, DOCX, dan TXT. Untuk PDF, teks diekstrak otomatis. Jika PDF berisi gambar/chart, Gemini Vision akan membacanya." },
                { q: "Berapa lama proses analisis?", a: "Rata-rata 8–15 detik tergantung panjang dokumen. PDF dengan banyak gambar sedikit lebih lama karena proses rendering." },
                { q: "Apakah bisa tempel teks langsung?", a: "Bisa. Ada opsi paste teks tanpa perlu upload file, cocok untuk cek cepat paragraf atau bagian tertentu." },
              ].map((item) => (
                <details key={item.q} className="group bg-white/70 backdrop-blur-sm rounded-2xl border border-white/60 p-6 open:bg-white/90 transition-colors">
                  <summary className="flex justify-between items-center font-semibold text-[#0b1c30] cursor-pointer list-none text-base">
                    {item.q}
                    <ChevronDown className="w-4 h-4 ml-4 text-teal-500 transition-transform duration-200 group-open:rotate-180" strokeWidth={2} />
                  </summary>
                  <p className="text-sm text-[#3d4947] mt-4 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-[1120px] mx-auto px-6 py-24 text-center relative z-10">
          <div className="bg-white/60 backdrop-blur-sm p-16 rounded-[40px] border border-white/60 shadow-[0_20px_60px_rgba(13,148,136,0.12)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-400/10 to-transparent pointer-events-none" />
            <h2 className="text-5xl font-extrabold tracking-tight text-[#0b1c30] mb-5 relative z-10">
              Siap Menyempurnakan<br />Tulisan Lo?
            </h2>
            <p className="text-lg text-[#3d4947] mb-10 max-w-xl mx-auto relative z-10">
              Analisis bias + konsistensi sekaligus. Gratis, tanpa daftar.
            </p>
            <button
              onClick={handleCtaClick}
              className="bg-teal-600 text-white text-base font-bold px-12 py-5 rounded-full hover:bg-teal-700 hover:shadow-[0_10px_40px_rgba(13,148,136,0.4)] hover:-translate-y-1 active:scale-95 transition-all duration-300 min-h-[44px] relative z-10"
            >
              Mulai Analisis Sekarang 
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-white/40 w-full py-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-[1120px] mx-auto px-6 gap-6">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Teliti" className="h-7" />
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={scrollToSection(item.id)}
                className="text-sm text-[#6d7a77] hover:text-teal-600 transition-colors font-medium"
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="text-xs text-[#6d7a77] text-center md:text-right">
            © 2026 Teliti AI<br />
            <span className="opacity-60">by @wubulugulu</span>
          </div>
        </div>
      </footer>
    </div>
  );
}