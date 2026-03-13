import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "Verbum",
  description:
    "Everything is a conversation. Verbum turns models, terminals, humans, and tools into one observable message graph."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} ${mono.variable}`}>
        <div className="site-shell">
          <header className="site-header">
            <Link className="brand" href="/">
              Verbum
            </Link>
            <nav className="site-nav">
              <Link href="/docs">Docs</Link>
              <Link href="/graph">Graph</Link>
              <a href="https://github.com/verbum-ai/verbum">GitHub</a>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
