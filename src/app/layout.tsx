import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Koya Proposals",
  description: "AI-powered proposal generation for Koya Talent",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="border-b border-[var(--surface-border)] bg-[var(--surface)]">
          <div className="w-full px-8 sm:px-12 h-16 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
              Koya Proposals
            </Link>
            <Link
              href="/proposals/new"
              className="px-5 py-2.5 bg-[var(--accent)] text-white text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
            >
              New Proposal
            </Link>
          </div>
        </nav>
        <main className="w-full px-8 sm:px-12 py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
