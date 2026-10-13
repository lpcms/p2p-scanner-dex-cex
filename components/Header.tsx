"use client";

import { useEffect, useState, type ReactNode } from "react";
import RelativeTime from "./RelativeTime";
import GasPrices from "./GasPrices";
import type { StrategyDirection } from "@/types/strategy";

interface HeaderProps {
  lastScan: number;
  scanInProgress: boolean;
  scanProgress: { done: number; total: number };
  resultCount: number;
  onRefresh: () => void;
  onOpenStrategy: (direction: StrategyDirection) => void;
}

export default function Header({
  lastScan,
  scanInProgress,
  scanProgress,
  resultCount,
  onRefresh,
  onOpenStrategy,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 header-glow">
      <div className="mx-auto w-full max-w-[1488px] px-6 pt-4">
        <div className="rounded-xl border border-border bg-bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-green to-accent-blue flex items-center justify-center font-display font-bold text-lg text-bg">
                  ⇌
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-green pulse-dot" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg leading-none tracking-tight">
                  P2P Scanner
                  <span className="text-accent-green ml-1.5">[DEX]</span>
                </h1>
                <p className="text-[11px] text-text-primary font-semibold mt-1 uppercase tracking-wider">
                  Gate.io ↔ DexScreener Arbitrage
                </p>
              </div>
            </div>

            {/* Strategies menu */}
            <nav className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => onOpenStrategy("CEX_TO_DEX")}
                className="group inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-accent-red/60 hover:bg-accent-red/5 transition-colors"
                title="Open strategy: buy on Gate, sell on DEX, hedge with short futures"
              >
                <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-bold bg-accent-red-bg text-accent-red border border-accent-red/30">
                  CEX → DEX
                </span>
                <span className="text-[12px] font-semibold text-text-primary">
                  Strategy 1
                </span>
              </button>
              <button
                onClick={() => onOpenStrategy("DEX_TO_CEX")}
                className="group inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-accent-green/60 hover:bg-accent-green/5 transition-colors"
                title="Open strategy: buy on DEX, sell on Gate, hedge with short futures"
              >
                <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-bold bg-accent-green-bg text-accent-green border border-accent-green/30">
                  DEX → CEX
                </span>
                <span className="text-[12px] font-semibold text-text-primary">
                  Strategy 2
                </span>
              </button>
            </nav>

            {/* Gas prices (network fees) */}
            <GasPrices />

            {/* Status / Actions */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-5 px-4 py-2 rounded-lg bg-bg-card border border-border">
                <Stat label="Pairs" value={resultCount.toString()} />
                <Divider />
                <Stat
                  label="Status"
                  value={
                    scanInProgress ? (
                      <span className="flex items-center gap-2">
                        <span>Scanning</span>
                        {scanProgress.total > 0 && (
                          <span className="text-text-secondary text-xs font-normal">
                            {scanProgress.done}/{scanProgress.total}
                          </span>
                        )}
                      </span>
                    ) : lastScan === 0 ? (
                      "Loading…"
                    ) : (
                      <StatusByAge lastScan={lastScan} />
                    )
                  }
                  color={
                    scanInProgress
                      ? "text-accent-yellow"
                      : lastScan === 0
                        ? "text-text-secondary"
                        : "text-accent-green"
                  }
                />
                <Divider />
                <Stat
                  label="Last update"
                  value={
                    lastScan > 0 ? (
                      <RelativeTime ts={lastScan} fallback="…" />
                    ) : (
                      "never"
                    )
                  }
                  color="text-text-secondary"
                />
              </div>

              <button
                onClick={onRefresh}
                disabled={scanInProgress}
                className="px-4 py-2 rounded-lg bg-accent-green text-bg font-semibold text-sm hover:bg-accent-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {scanInProgress ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                    Scanning
                  </span>
                ) : (
                  "↻ Refresh"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  color = "text-text-primary",
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-text-primary font-semibold">
        {label}
      </span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-7 bg-border" />;
}

/**
 * Показывает "Live" если данные свежие (<35с), "Stale" если устарели.
 * Тикает на клиенте, чтобы избежать SSR mismatch.
 */
function StatusByAge({ lastScan }: { lastScan: number }) {
  const [mounted, setMounted] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return <>Ready</>;
  const ageSec = Math.floor((Date.now() - lastScan) / 1000);
  if (ageSec < 5) return <>Updated</>;
  if (ageSec < 35) return <>Live</>;
  return <span className="text-accent-yellow">Stale</span>;
}
