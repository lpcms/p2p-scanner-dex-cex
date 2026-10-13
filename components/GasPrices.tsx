"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 минут

interface GasResponse {
  ok: boolean;
  gas: Record<string, number>;
  cacheAge: number;
  fromCache: boolean;
}

/**
 * Маленький блок в шапке: показывает текущий gas (USD) в трёх сетях.
 * Обновляется раз в 10 минут.
 */
export default function GasPrices() {
  const [gas, setGas] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchGas = async () => {
      try {
        const res = await fetch("/api/gas", { cache: "no-store" });
        const data: GasResponse = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setGas(data.gas);
          setError(null);
        } else {
          setError("Failed to fetch");
        }
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message);
      }
    };

    fetchGas();
    const t = setInterval(fetchGas, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const items: Array<{ key: string; label: string; color: string }> = [
    { key: "ethereum", label: "ETH", color: "text-accent-blue" },
    { key: "bsc", label: "BSC", color: "text-accent-yellow" },
    { key: "solana", label: "SOL", color: "text-accent-green" },
  ];

  return (
    <div
      className="hidden xl:flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-bg-card"
      title="Estimated gas cost for a DEX swap in each network. Updated every 10 minutes."
    >
      <span className="text-[10px] uppercase tracking-wider text-text-primary font-bold whitespace-nowrap">
        Gas
      </span>
      {items.map((item) => (
        <div key={item.key} className="flex items-baseline gap-1">
          <span className={`text-[11px] font-bold ${item.color}`}>
            {item.label}
          </span>
          <span className="text-[12px] font-semibold text-text-primary tabular-nums">
            {formatGas(gas?.[item.key])}
          </span>
        </div>
      ))}
      {error && (
        <span className="text-[10px] text-accent-red" title={error}>
          ⚠
        </span>
      )}
    </div>
  );
}

function formatGas(v: number | undefined): string {
  if (v === undefined || !isFinite(v)) return "…";
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(4)}`;
}
