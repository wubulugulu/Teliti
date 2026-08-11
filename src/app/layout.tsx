import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
});

export const metadata: Metadata = {
  title: "BiasDetect - Analisis Dokumen AI",
  description: "Deteksi bias tersembunyi dan cek konsistensi dokumen penelitian dengan AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={plusJakarta.variable}>
      <body className="bg-background text-on-surface font-sans antialiased">{children}</body>
    </html>
  );
}