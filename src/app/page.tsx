"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

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
        <nav className="flex justify-between items-center h-20 max-w-[1120px] mx-auto px-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center text-white font-bold text-sm">T</div>
            <span className="font-bold text-xl tracking-tight text-[#0b1c30]">Teliti</span>
          </div>
          <div className="hidden md:flex gap-10">
            <a href="#fitur" className="text-sm font-semibold text-teal-600 border-b-2 border-teal-600 pb-1">Fitur</a>
            <a href="#cara-kerja" className="text-sm font-medium text-[#3d4947] hover:text-teal-600 transition-colors">Cara Kerja</a>
            <a href="#faq" className="text-sm font-medium text-[#3d4947] hover:text-teal-600 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/analyze")}
              className="hidden md:block text-sm font-semibold bg-teal-600 text-white px-6 py-2.5 rounded-full hover:bg-teal-700 hover:shadow-[0_0_20px_rgba(13,148,136,0.35)] transition-all duration-300 min-h-[44px]"
            >
              Coba Gratis
            </button>
          </div>
        </nav>
      </header>

      <main className="flex-grow pt-20 relative z-10">

        {/* Hero */}
        <section className="max-w-[1120px] mx-auto px-6 py-24 md:py-32 grid md:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col items-start">
            <span className="mb-5 inline-flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
              Powered by Gemini AI
            </span>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-[#0b1c30]">
              Analisis Dokumen dengan{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-teal-400">
                Presisi AI
              </span>
            </h1>
            <p className="text-lg text-[#3d4947] mb-10 max-w-lg leading-relaxed">
              Deteksi bias tersembunyi <em>dan</em> periksa konsistensi dokumen penelitian lo dalam satu kali upload. Hasil instan, saran konkret.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push("/analyze")}
                className="bg-teal-600 text-white text-sm font-semibold px-8 py-4 rounded-full hover:bg-teal-700 hover:shadow-[0_8px_30px_rgba(13,148,136,0.3)] hover:-translate-y-0.5 transition-all duration-300 min-h-[44px]"
              >
                Mulai Analisis →
              </button>
              <a
                href="#cara-kerja"
                className="bg-white/70 border border-teal-200 text-teal-700 text-sm font-semibold px-8 py-4 rounded-full hover:bg-white hover:shadow-md transition-all duration-300 min-h-[44px] text-center"
              >
                Lihat Cara Kerja
              </a>
            </div>

            {/* Stats */}
            <div className="mt-12 flex gap-8">
              {[
                { val: "2 Fitur", label: "dalam 1 analisis" },
                { val: "3 Format", label: "PDF, DOCX, TXT" },
                { val: "~10 dtk", label: "rata-rata hasil" },
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
                <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">T</div>
                <div>
                  <div className="text-sm font-bold text-[#0b1c30]">Skripsi_Final.pdf</div>
                  <div className="text-xs text-[#6d7a77]">Analisis selesai · 8 detik</div>
                </div>
                <div className="ml-auto w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
              </div>

              <div className="space-y-3">
                {/* Bias score */}
                <div className="bg-teal-50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-teal-700">Bias Score</span>
                    <span className="text-xl font-bold text-teal-600">72</span>
                  </div>
                  <div className="h-2 bg-teal-100 rounded-full overflow-hidden">
                    <div className="h-full w-[72%] bg-gradient-to-r from-teal-500 to-teal-400 rounded-full" />
                  </div>
                </div>

                {/* Consistency score */}
                <div className="bg-blue-50 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-blue-700">Konsistensi Score</span>
                    <span className="text-xl font-bold text-blue-600">85</span>
                  </div>
                  <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div className="h-full w-[85%] bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" />
                  </div>
                </div>

                {/* Issues */}
                <div className="space-y-2">
                  {[
                    { label: "Gender Bias", sev: "high", color: "bg-red-100 text-red-600" },
                    { label: "Inkonsistensi Bab III↔V", sev: "medium", color: "bg-amber-100 text-amber-600" },
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
        <section id="cara-kerja" className="py-24 relative">
          <div className="max-w-[1120px] mx-auto px-6 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-[#0b1c30] mb-4">Cara Kerja Teliti</h2>
            <p className="text-lg text-[#3d4947] max-w-2xl mx-auto mb-16">
              Tiga langkah — satu upload, dua hasil analisis.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-1/3 left-[18%] right-[18%] h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent z-0" />
              {[
                { step: "1", title: "Unggah Dokumen", desc: "Upload PDF, DOCX, atau tempel teks langsung. Maksimal 10MB.", icon: "📄" },
                { step: "2", title: "AI Menganalisis", desc: "Gemini & Groq AI bekerja paralel — deteksi bias + cek konsistensi sekaligus.", icon: "🤖" },
                { step: "3", title: "Terima Insight", desc: "Hasil lengkap: score, temuan per kategori, dan saran perbaikan konkret.", icon: "✨" },
              ].map((item) => (
                <div key={item.step} className="relative z-10 bg-white/70 backdrop-blur-sm border border-white/60 p-8 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_rgba(13,148,136,0.12)] hover:-translate-y-1 transition-all duration-300 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center mb-5 text-3xl shadow-inner">
                    {item.icon}
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
        <section id="fitur" className="py-20">
          <div className="max-w-[1120px] mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight text-[#0b1c30] mb-4">Dua Fitur, Satu Analisis</h2>
              <p className="text-lg text-[#3d4947] max-w-xl mx-auto">Sekarang lo gak perlu pilih — keduanya jalan otomatis.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  icon: "🔍",
                  badge: "Deteksi Bias",
                  title: "Bias yang Tak Terlihat",
                  desc: "Identifikasi gender bias, age bias, socioeconomic bias, cultural bias, dan lainnya — lengkap dengan score per temuan dan saran perbaikan kalimat.",
                  tags: ["Gender", "Usia", "Budaya", "Rasial", "Konfirmasi"],
                  gradient: "from-teal-500 to-teal-400",
                },
                {
                  icon: "📊",
                  badge: "Cek Konsistensi",
                  title: "Keselarasan Antar Bab",
                  desc: "Pastikan Tujuan, Metode, Hasil, dan Kesimpulan saling mendukung. AI deteksi inkonsistensi logis, angka, terminologi, dan klaim referensi.",
                  tags: ["Logika", "Data & Angka", "Metodologi", "Terminologi"],
                  gradient: "from-blue-500 to-blue-400",
                },
              ].map((f) => (
                <div key={f.badge} className="bg-white/70 backdrop-blur-sm border border-white/60 p-10 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_rgba(13,148,136,0.12)] hover:-translate-y-1 transition-all duration-300">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center mb-5 shadow-lg text-xl`}>
                    {f.icon}
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
                { icon: "📋", label: "Proposal Bisnis" },
                { icon: "📈", label: "Laporan Tahunan" },
                { icon: "🎓", label: "Karya Ilmiah" },
                { icon: "📜", label: "Naskah Kebijakan" },
              ].map((d) => (
                <div key={d.label} className="bg-white/70 backdrop-blur-sm border border-white/60 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 text-center hover:shadow-[0_0_20px_rgba(13,148,136,0.15)] hover:-translate-y-0.5 transition-all duration-300 group">
                  <span className="text-3xl group-hover:scale-110 transition-transform duration-300">{d.icon}</span>
                  <span className="text-sm font-semibold text-[#0b1c30]">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20">
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
                    <span className="ml-4 text-teal-500 transition-transform duration-200 group-open:rotate-180">▾</span>
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
              onClick={() => router.push("/analyze")}
              className="bg-teal-600 text-white text-base font-bold px-12 py-5 rounded-full hover:bg-teal-700 hover:shadow-[0_10px_40px_rgba(13,148,136,0.4)] hover:-translate-y-1 transition-all duration-300 min-h-[44px] relative z-10"
            >
              Mulai Analisis Sekarang →
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white/50 backdrop-blur-sm border-t border-white/40 w-full py-12 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center max-w-[1120px] mx-auto px-6 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center text-white text-xs font-bold">T</div>
            <span className="font-bold text-lg text-[#0b1c30]">Teliti</span>
          </div>
          <div className="flex flex-wrap justify-center gap-8">
            {["Fitur", "Cara Kerja", "FAQ"].map((l) => (
              <a key={l} href={`#${l.toLowerCase().replace(" ", "-")}`} className="text-sm text-[#6d7a77] hover:text-teal-600 transition-colors font-medium">{l}</a>
            ))}
          </div>
          <div className="text-xs text-[#6d7a77] text-center md:text-right">
            © 2025 Teliti AI · ITFest 6.0<br />
            <span className="opacity-60">by @wubulugulu</span>
          </div>
        </div>
      </footer>
    </div>
  );
}