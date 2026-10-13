"use client";

import { useEffect, useState } from "react";
import type { StrategyDirection, StrategyCalculation } from "@/types/strategy";
import type { ScanResult, TradeAmount } from "@/types";
import { formatUsd, formatPercent, formatPrice } from "@/lib/format";

interface Props {
  open: boolean;
  direction: StrategyDirection;
  pinnedToken: ScanResult | null;
  tradeAmount: TradeAmount;
  onClose: () => void;
}

export default function StrategyModal({
  open,
  direction,
  pinnedToken,
  tradeAmount,
  onClose,
}: Props) {
  const [calc, setCalc] = useState<StrategyCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!pinnedToken) {
      setCalc(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const url = `/api/strategy?pair=${encodeURIComponent(pinnedToken.pair)}&chain=${encodeURIComponent(pinnedToken.chain)}&amount=${tradeAmount}&direction=${direction}`;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setCalc(data.strategy);
        } else {
          setError(data.error || "Unknown error");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, direction, pinnedToken, tradeAmount]);

  // ESC закрывает
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isCexToDex = direction === "CEX_TO_DEX";
  const title = isCexToDex
    ? "Strategy 1: CEX → DEX (buy spot, hedge with short)"
    : "Strategy 2: DEX → CEX (short first, then buy on DEX)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-xl border border-border bg-bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[12px] font-bold ${
                isCexToDex
                  ? "bg-accent-red-bg text-accent-red border border-accent-red/30"
                  : "bg-accent-green-bg text-accent-green border border-accent-green/30"
              }`}
            >
              {isCexToDex ? "CEX → DEX" : "DEX → CEX"}
            </span>
            <h2 className="text-[18px] font-bold text-text-primary">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 rounded border border-border text-text-secondary hover:bg-accent-red hover:border-accent-red hover:text-bg transition-colors"
            aria-label="Close"
          >
            <span className="text-[24px] leading-none">×</span>
          </button>
        </div>

        <div className="p-6">
          {!pinnedToken && (
            <NoTokenState />
          )}

          {pinnedToken && loading && (
            <div className="text-center py-12 text-text-secondary">
              <div className="inline-block w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin mb-3" />
              <div>Calculating strategy…</div>
            </div>
          )}

          {pinnedToken && error && (
            <div className="rounded-lg border border-accent-red/30 bg-accent-red/10 p-4 text-accent-red text-sm">
              ⚠ {error}
            </div>
          )}

          {pinnedToken && calc && !loading && (
            <StrategyView calc={calc} token={pinnedToken} />
          )}
        </div>
      </div>
    </div>
  );
}

function NoTokenState() {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3 opacity-30">🎯</div>
      <p className="text-text-primary font-semibold mb-2">
        No token selected
      </p>
      <p className="text-text-secondary text-sm">
        Click on any row in the results table to pin a token, then re-open this strategy.
      </p>
    </div>
  );
}

function StrategyView({
  calc,
  token,
}: {
  calc: StrategyCalculation;
  token: ScanResult;
}) {
  const isCexToDex = calc.direction === "CEX_TO_DEX";

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KV label="Token" value={token.symbol} />
        <KV label="Network" value={token.chain} />
        <KV label="Trade Amount" value={formatUsd(calc.tradeAmount)} />
        <KV
          label="Direction"
          value={isCexToDex ? "CEX → DEX" : "DEX → CEX"}
        />
      </div>

      {/* Steps */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-text-primary font-bold mb-3">
          Execution plan
        </h3>
        <ol className="space-y-2">
          {calc.steps.map((step) => (
            <li
              key={step.num}
              className="flex gap-3 p-3 rounded-lg border border-border bg-bg-elevated"
            >
              <div
                className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-[13px] ${
                  step.warning
                    ? "bg-accent-yellow/20 text-accent-yellow border border-accent-yellow/40"
                    : "bg-accent-blue/20 text-accent-blue border border-accent-blue/40"
                }`}
              >
                {step.num}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-bold text-text-primary">
                    {step.title}
                  </span>
                  <VenueBadge venue={step.venue} />
                  {step.durationMin > 0 && (
                    <span className="text-[11px] text-text-secondary">
                      ~{step.durationMin} min
                    </span>
                  )}
                </div>
                <p className="text-[13px] text-text-secondary mt-1 leading-snug">
                  {step.description}
                </p>
                {(step.cost ?? 0) > 0 && (
                  <div className="text-[11px] text-accent-red mt-1">
                    Cost: −{formatUsd(step.cost!)}
                  </div>
                )}
                {step.warning && (
                  <div className="text-[12px] text-accent-yellow font-semibold mt-1">
                    ⚠ {step.warning}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Cost breakdown */}
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-text-primary font-bold mb-3">
          Cost breakdown
        </h3>
        <div className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
          <CostRow label="CEX Spot taker fee (0.1%)" value={calc.cexSpotFee} />
          {calc.cexFuturesFee > 0 && (
            <CostRow
              label="CEX Futures taker fee × 2 (0.05% × 2)"
              value={calc.cexFuturesFee}
            />
          )}
          <CostRow label="DEX pool fee (≈0.3%)" value={calc.dexPoolFee} />
          <CostRow
            label={isCexToDex ? "Withdrawal fee (CEX → network)" : "Deposit fee (network → CEX)"}
            value={calc.withdrawalFee}
          />
          <CostRow label="Gas (DEX swap)" value={calc.gasFee} />
          <div className="px-4 py-2 border-t border-border flex justify-between text-[13px] font-bold">
            <span className="text-text-primary">Total costs</span>
            <span className="text-accent-red">−{formatUsd(calc.totalCosts)}</span>
          </div>
        </div>
      </div>

      {/* Funding & hedge */}
      {calc.cexFuturesFee > 0 && (
        <div>
          <h3 className="text-[11px] uppercase tracking-wider text-text-primary font-bold mb-3">
            Hedge & funding rate
          </h3>
          <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-2 text-[13px]">
            <div className="flex justify-between">
              <span className="text-text-secondary">Current funding rate (per {calc.fundingIntervalHours}h)</span>
              <span
                className={`font-bold ${
                  calc.fundingRate < 0
                    ? "text-accent-green"
                    : calc.fundingRate > 0
                      ? "text-accent-red"
                      : "text-text-primary"
                }`}
              >
                {(calc.fundingRate * 100).toFixed(4)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Estimated hold time</span>
              <span className="font-bold text-text-primary">
                ~{(calc.estimatedHoldTimeHours * 60).toFixed(0)} min
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-text-secondary">Funding cost / income for SHORT</span>
              <span
                className={`font-bold ${
                  calc.fundingCost >= 0 ? "text-accent-green" : "text-accent-red"
                }`}
              >
                {calc.fundingCost >= 0 ? "+" : ""}
                {formatUsd(calc.fundingCost)}
              </span>
            </div>
            <p className="text-[11px] text-text-secondary leading-snug pt-2 border-t border-border">
              Short pays funding when rate is positive (longs are over-leveraged) and receives when negative.
              Short hold time is brief, so funding impact is usually small.
            </p>
          </div>
        </div>
      )}

      {/* Final P&L */}
      <div className="rounded-lg border-2 border-accent-blue/40 bg-accent-blue/5 p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-accent-blue font-bold mb-3">
          Net P&L (with hedge)
        </h3>
        <div className="space-y-1.5 text-[13px]">
          <Row label="Gross profit (sell − buy)" value={calc.grossProfit} positive />
          <Row label="Total costs" value={-calc.totalCosts} />
          {calc.cexFuturesFee > 0 && (
            <Row label="Funding (P&L of hedge)" value={calc.fundingCost} />
          )}
          <div className="border-t border-accent-blue/30 pt-2 mt-2 flex justify-between items-baseline">
            <span className="text-[14px] font-bold text-text-primary">Net profit</span>
            <div className="text-right">
              <div
                className={`text-[20px] font-bold ${
                  calc.netProfit > 0 ? "text-accent-green" : "text-accent-red"
                }`}
              >
                {calc.netProfit >= 0 ? "+" : ""}
                {formatUsd(calc.netProfit)}
              </div>
              <div
                className={`text-[12px] ${
                  calc.netProfit > 0 ? "text-accent-green" : "text-accent-red"
                }`}
              >
                {formatPercent(calc.netProfitPercent)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Without hedge comparison */}
      <div className="rounded-lg border border-border bg-bg-elevated p-4">
        <h3 className="text-[11px] uppercase tracking-wider text-text-primary font-bold mb-2">
          For comparison: without hedge
        </h3>
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[13px] text-text-secondary">Net profit (no futures hedge)</span>
          <span
            className={`text-[16px] font-bold ${
              calc.unhedgedNetProfit > 0 ? "text-accent-green" : "text-accent-red"
            }`}
          >
            {calc.unhedgedNetProfit >= 0 ? "+" : ""}
            {formatUsd(calc.unhedgedNetProfit)}
          </span>
        </div>
        <p className="text-[12px] text-accent-yellow leading-snug">
          ⚠ {calc.unhedgedRisk}
        </p>
      </div>

      {/* Disclaimer */}
      <p className="text-[11px] text-text-secondary opacity-70 leading-snug">
        Estimates are based on current Gate.io and DexScreener data. Gas, funding rate, and prices may change while you execute. Always verify on the exchange before committing capital.
      </p>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-2">
      <div className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
        {label}
      </div>
      <div className="text-[14px] font-bold text-text-primary mt-0.5">{value}</div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-2 border-b border-border last:border-b-0 flex justify-between text-[13px]">
      <span className="text-text-secondary">{label}</span>
      <span className="text-accent-red font-mono">−{formatUsd(value)}</span>
    </div>
  );
}

function Row({
  label,
  value,
  positive,
}: {
  label: string;
  value: number;
  positive?: boolean;
}) {
  const color = positive
    ? value >= 0
      ? "text-accent-green"
      : "text-accent-red"
    : value >= 0
      ? "text-accent-green"
      : "text-accent-red";
  return (
    <div className="flex justify-between text-[13px]">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-mono ${color}`}>
        {value >= 0 ? "+" : ""}
        {formatUsd(value)}
      </span>
    </div>
  );
}

function VenueBadge({ venue }: { venue: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    CEX_SPOT: {
      label: "CEX SPOT",
      cls: "bg-accent-green-bg text-accent-green border-accent-green/40",
    },
    CEX_FUTURES: {
      label: "CEX FUTURES",
      cls: "bg-accent-yellow/15 text-accent-yellow border-accent-yellow/40",
    },
    DEX: {
      label: "DEX",
      cls: "bg-accent-blue/15 text-accent-blue border-accent-blue/40",
    },
    NETWORK: {
      label: "ON-CHAIN",
      cls: "bg-bg-card text-text-secondary border-border",
    },
  };
  const cfg = map[venue] ?? map.NETWORK;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0 rounded text-[10px] font-bold border ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}
