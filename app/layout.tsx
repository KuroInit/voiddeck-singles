import type { Metadata } from "next";
import Link from "next/link";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
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

const cinzel = Cinzel({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Voiddeck Singles — Riftbound TCG singles, Singapore",
  description:
    "The void-deck card market for Riftbound. Buy, sell, and look for Riftbound singles in Singapore. Demo — all listings are fictional.",
};

export const viewport = {
  themeColor: "#010a13",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} antialiased min-h-dvh flex flex-col`}
      >
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="mt-6 py-6 text-[13px] text-muted-foreground sm:py-8">
          <div className="rune-divider mx-auto max-w-6xl" />
          <div className="mx-auto mt-5 flex max-w-6xl flex-col gap-2 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/notes" className="text-gold underline-offset-2 hover:underline">
                Notes
              </Link>
              <span>All listings are fictional demo data</span>
              <span>Unofficial fan demo, not affiliated with Riot Games</span>
            </div>
            <span>
              Voiddeck Singles · Singapore — <span className="text-gold">confirm can find one</span>
            </span>
          </div>
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
