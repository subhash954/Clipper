import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clipper AI — Professional Video Repurposing & Viral Shorts Studio",
  description: "Turn long-form videos into high-retention vertical shorts with dynamic word-level subtitles, AI B-roll, and multi-track creator editing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen bg-[#F8FAFC] text-slate-900 antialiased selection:bg-red-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
