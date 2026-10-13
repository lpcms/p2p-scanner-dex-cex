import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "P2P Scanner [DEX] — Gate.io ↔ DexScreener Arbitrage",
  description:
    "Real-time arbitrage scanner between Gate.io (CEX) and decentralized exchanges via DexScreener.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className="bg-bg text-text-primary min-h-screen bg-grid"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
