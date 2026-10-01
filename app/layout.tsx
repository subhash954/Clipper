import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clipper - AI YouTube Video Repurposer & Viral Shorts Studio",
  description: "Turn 1-hour long YouTube videos into 15 viral shorts with Hormozi animated subtitles, auto B-roll, and 1-click social scheduling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-slate-900 antialiased selection:bg-red-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
