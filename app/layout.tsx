import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voiddeck Singles — Riftbound TCG singles, Singapore",
  description:
    "The void-deck card market for Runeterra. Buy, sell, and look for Riftbound singles in Singapore. Demo — all listings are fictional.",
};

export const viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-dvh flex flex-col`}>
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border/60 py-6 text-xs text-muted-foreground">
          <div className="mx-auto max-w-6xl px-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/notes" className="hover:text-foreground underline-offset-2 hover:underline">
                Notes
              </Link>
              <span>All listings are fictional demo data</span>
              <span>Unofficial fan demo, not affiliated with Riot Games</span>
            </div>
            <span>Voiddeck Singles · Singapore</span>
          </div>
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
