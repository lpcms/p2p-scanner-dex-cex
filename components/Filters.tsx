"use client";

import { useState, useEffect, type ReactNode, type KeyboardEvent } from "react";
import type { TradeAmount, ScanResult } from "@/types";
import PinnedTokenCard from "./PinnedTokenCard";
import NetworkMultiSelect from "./NetworkMultiSelect";

interface FiltersProps {
  tradeAmount: TradeAmount;
  onTradeAmountChange: (amount: TradeAmount) => void;
  minSpread: number;
  onMinSpreadChange: (v: number) => void;
  minLiquidity: number;
  onMinLiquidityChange: (v: number) => void;
  refreshIntervalMs: number;
  onRefreshIntervalChange: (ms: number) => void;
  direction: "ALL" | "DEX_TO_CEX" | "CEX_TO_DEX";
  onDirectionChange: (d: "ALL" | "DEX_TO_CEX" | "CEX_TO_DEX") => void;
  /** Выбранные сети. ["ALL"] или [] = все сети. */
  chains: string[];
  onChainsChange: (chains: string[]) => void;
  availableChains: string[];
  blacklist: string[];
  /**
   * Добавление в blacklist. Возвращает сообщение об ошибке,
   * либо null если успешно. Например: "Token PEPE is already in Whitelist".
   */
  onBlacklistAdd: (ticker: string) => string | null;
  onBlacklistRemove: (ticker: string) => void;
  whitelist: string[];
  onWhitelistAdd: (ticker: string) => string | null;
  onWhitelistRemove: (ticker: string) => void;
  /**
   * Тикеры токенов, по которым сейчас есть данные в скане.
   * Используется для подсветки активных токенов в списке Whitelist.
   */
  activeSymbols: Set<string>;
  /** Закреплённый токен — снапшот на момент клика в таблице */
  pinnedToken: ScanResult | null;
  /** Удалить закреплённый токен (крестик в карточке) */
  onPinnedClear: () => void;
}

export default function Filters({
  tradeAmount,
  onTradeAmountChange,
  minSpread,
  onMinSpreadChange,
  minLiquidity,
  onMinLiquidityChange,
  refreshIntervalMs,
  onRefreshIntervalChange,
  direction,
  onDirectionChange,
  chains,
  onChainsChange,
  availableChains,
  blacklist,
  onBlacklistAdd,
  onBlacklistRemove,
  whitelist,
  onWhitelistAdd,
  onWhitelistRemove,
  activeSymbols,
  pinnedToken,
  onPinnedClear,
}: FiltersProps) {
  const [blacklistInput, setBlacklistInput] = useState("");
  const [whitelistInput, setWhitelistInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Авто-скрытие ошибки через 4 секунды
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  const submitBlacklist = () => {
    const v = blacklistInput.trim();
    if (!v) return;
    const err = onBlacklistAdd(v);
    if (err) {
      setError(err);
    } else {
      setError(null);
      setBlacklistInput("");
    }
  };

  const onBlacklistKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitBlacklist();
    }
  };

  const submitWhitelist = () => {
    const v = whitelistInput.trim();
    if (!v) return;
    const err = onWhitelistAdd(v);
    if (err) {
      setError(err);
    } else {
      setError(null);
      setWhitelistInput("");
    }
  };

  const onWhitelistKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitWhitelist();
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1488px] px-6 py-4">
      <div className="rounded-xl border border-border bg-bg-card p-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          {/* Trade amount */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-text-primary font-semibold">
              Trade Amount
            </label>
            <div className="flex bg-bg rounded-lg p-1 border border-border">
              {(
                [
                  { value: 100 as const, label: "$100" },
                  { value: 1000 as const, label: "$1,000" },
                ]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onTradeAmountChange(value)}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                    tradeAmount === value
                      ? "bg-accent-green text-bg"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Min spread */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-text-primary font-semibold">
              Min Spread (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={minSpread}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onMinSpreadChange(parseFloat(e.target.value) || 0)
                }
                step="0.1"
                min="0"
                className="w-24 px-3 py-1.5 rounded-md bg-bg border border-border text-sm font-semibold focus:outline-none focus:border-accent-green"
              />
            </div>
          </div>

          {/* DEX Liquidity (visual only — пока не влияет на фильтрацию) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-text-primary font-semibold">
              DEX Liquidity
            </label>
            <div className="flex bg-bg rounded-lg p-1 border border-border">
              {(
                [
                  { value: 50_000, label: "50K" },
                  { value: 100_000, label: "100K" },
                  { value: 200_000, label: "200K" },
                ]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onMinLiquidityChange(value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                    minLiquidity === value
                      ? "bg-accent-blue text-bg"
                      : "text-text-primary font-semibold hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh interval */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-text-primary font-semibold">
              Refresh
            </label>
            <div className="flex bg-bg rounded-lg p-1 border border-border">
              {(
                [
                  { value: 60_000, label: "1 m" },
                  { value: 120_000, label: "2 m" },
                  { value: 300_000, label: "5 m" },
                ]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => onRefreshIntervalChange(value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                    refreshIntervalMs === value
                      ? "bg-accent-blue text-bg"
                      : "text-text-primary font-semibold hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Direction */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-text-primary font-semibold">
              Direction
            </label>
            <div className="flex bg-bg rounded-lg p-1 border border-border">
              <DirBtn
                active={direction === "ALL"}
                onClick={() => onDirectionChange("ALL")}
              >
                All
              </DirBtn>
              <DirBtn
                active={direction === "DEX_TO_CEX"}
                onClick={() => onDirectionChange("DEX_TO_CEX")}
              >
                DEX → CEX
              </DirBtn>
              <DirBtn
                active={direction === "CEX_TO_DEX"}
                onClick={() => onDirectionChange("CEX_TO_DEX")}
              >
                CEX → DEX
              </DirBtn>
            </div>
          </div>

          {/* Chain (multi-select) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-text-primary font-semibold">
              Network
            </label>
            <NetworkMultiSelect
              available={availableChains}
              selected={chains}
              onChange={onChainsChange}
            />
          </div>

          {/* Blacklist */}
          <div className="flex flex-col gap-1.5 w-32">
            <label className="text-[10px] uppercase tracking-wider text-text-primary font-semibold">
              Blacklist
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={blacklistInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setBlacklistInput(e.target.value)
                }
                onKeyDown={onBlacklistKeyDown}
                placeholder="Ticker..."
                className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-bg border border-border text-sm focus:outline-none focus:border-accent-red uppercase"
              />
              <button
                onClick={submitBlacklist}
                disabled={!blacklistInput.trim()}
                className="shrink-0 px-2 py-1.5 rounded-md bg-bg border border-border text-sm font-bold text-text-secondary hover:border-accent-red hover:text-accent-red disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Add to blacklist"
              >
                +
              </button>
            </div>
          </div>

          {/* Whitelist */}
          <div className="flex flex-col gap-1.5 w-32">
            <label className="text-[10px] uppercase tracking-wider text-text-primary font-semibold">
              Whitelist
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={whitelistInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setWhitelistInput(e.target.value)
                }
                onKeyDown={onWhitelistKeyDown}
                placeholder="Ticker..."
                className="flex-1 min-w-0 px-2 py-1.5 rounded-md bg-bg border border-border text-sm focus:outline-none focus:border-accent-green uppercase"
              />
              <button
                onClick={submitWhitelist}
                disabled={!whitelistInput.trim()}
                className="shrink-0 px-2 py-1.5 rounded-md bg-bg border border-border text-sm font-bold text-text-secondary hover:border-accent-green hover:text-accent-green disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Add to whitelist"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Validation error */}
        {error && (
          <div className="mt-3 px-3 py-2 rounded-md border border-accent-yellow/50 bg-accent-yellow/10 text-[12px] font-semibold text-accent-yellow">
            ⚠ {error}
          </div>
        )}

        {/* Blacklist chips row */}
        {blacklist.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-text-primary font-semibold mr-1">
              Hidden ({blacklist.length}):
            </span>
            {blacklist.map((t) => (
              <button
                key={t}
                onClick={() => onBlacklistRemove(t)}
                className="group inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded text-[11px] font-semibold bg-accent-red-bg border border-accent-red/30 text-accent-red hover:bg-accent-red hover:text-bg transition-colors"
                title={`Remove ${t} from blacklist`}
              >
                <span>{t}</span>
                <span className="text-[14px] leading-none opacity-70 group-hover:opacity-100">
                  ×
                </span>
              </button>
            ))}
            <button
              onClick={() =>
                blacklist.forEach((t) => onBlacklistRemove(t))
              }
              className="ml-auto text-[10px] uppercase tracking-wider text-text-primary font-semibold hover:text-text-secondary transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Whitelist chips row */}
        {whitelist.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-text-primary font-semibold mr-1">
              Success ({whitelist.length}):
            </span>
            {whitelist.map((t) => {
              const isActive = activeSymbols.has(t.toUpperCase());
              return (
                <button
                  key={t}
                  onClick={() => onWhitelistRemove(t)}
                  className={
                    isActive
                      ? "group inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded text-[11px] font-semibold bg-accent-green border border-accent-green text-bg hover:bg-accent-green/80 transition-colors"
                      : "group inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded text-[11px] font-semibold bg-accent-green-bg border border-accent-green/30 text-accent-green hover:bg-accent-green hover:text-bg transition-colors"
                  }
                  title={
                    isActive
                      ? `Active in scan. Click to remove ${t} from whitelist`
                      : `Not currently in scan. Click to remove ${t} from whitelist`
                  }
                >
                  <span>{t}</span>
                  <span className="text-[14px] leading-none opacity-80 group-hover:opacity-100">
                    ×
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => whitelist.forEach((t) => onWhitelistRemove(t))}
              className="ml-auto text-[10px] uppercase tracking-wider text-text-primary font-semibold hover:text-text-secondary transition-colors"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Pinned token card (closes via × button on the card) */}
        {pinnedToken && (
          <PinnedTokenCard token={pinnedToken} onClear={onPinnedClear} />
        )}
      </div>
    </div>
  );
}

function DirBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
        active ? "bg-accent-blue text-bg" : "text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}
