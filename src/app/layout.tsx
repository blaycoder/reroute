import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import { DemoBadge } from "@/components/ui/DemoBadge";
import "katex/dist/katex.min.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Reroute — Diagnosis-first JAMB Mathematics",
  description:
    "Reroute finds the root misconception behind every wrong answer, then teaches the fix.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable} antialiased`}>
        <ToastProvider>{children}</ToastProvider>
        <DemoBadge />
      </body>
    </html>
  );
}
