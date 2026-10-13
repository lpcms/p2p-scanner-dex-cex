"use client";

import type { ScanResult } from "@/types";
import {
  formatPrice,
  formatPercent,
  formatProfit,
  formatUsd,
} from "@/lib/format";
import { getExplorerUrl } from "@/lib/gate";
import { getDexSwapUrl } from "@/lib/dexscreener";
import CopyButton from "./CopyButton";

interface Props {
  token: ScanResult;
  onClear: () => void;
}

/**
 * Компактная карточка закреплённого токена, отображается под Whitelist
 * в блоке Filters. Содержит снапшот данных строки на момент клика.
 *
 * Структура повторяет одну строку таблицы результатов (без заголовков колонок),
 * чтобы было визуально понятно "это та же строка".
 */
export default function PinnedTokenCard({ token, onClear }: Props) {
  const explorerUrl = getExplorerUrl(token.chain, token.contractAddress);
  const cmcUrl = `https://coinmarketcap.com/currencies/${token.symbol.toLowerCase()}/`;

  const profit = token.bestProfit;
  const spread = token.bestSpread;
  const profitable = profit > 0;
  const direction = token.bestDirection;

  // Прямая ссылка на DEX биржу (как в таблице)
  const dexSwapUrl =
    getDexSwapUrl(
      token.dexId,
      token.dexChainId,
      token.contractAddress,
      token.dexPairAddress
    ) ?? token.dexUrl;
  const dexDisplay = getDexDisplayName(token.dexId);

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="rounded-lg border border-accent-blue/40 bg-accent-blue/5 py-2">
        <div className="flex flex-wrap items-stretch justify-center gap-y-1">
          {/* Label */}
          <Cell>
            <span className="text-[17px] uppercase tracking-wider text-text-primary font-bold whitespace-nowrap">
              Selected token
            </span>
          </Cell>

          {/* Token: ticker + icons / contract address */}
          <Cell>
            <div className="flex flex-col leading-tight">
              <div className="flex items-center gap-2">
                <a
                  href={cmcUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-text-primary hover:text-accent-green transition-colors"
                  title="Open on CoinMarketCap"
                >
                  {token.symbol}
                </a>
                <a
                  href={token.dexUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-[18px] h-[18px] leading-none text-text-primary opacity-50 hover:opacity-100 hover:text-accent-blue transition-colors"
                  title="Open pool on DexScreener"
                  aria-label="Open on DexScreener"
                >
                  <span className="text-[14px]">⧉</span>
                </a>
                {token.contractAddress && (
                  <CopyButton
                    text={token.contractAddress}
                    title="Copy contract address"
                    colorClass="text-text-primary opacity-50 hover:opacity-100 hover:text-accent-yellow"
                  />
                )}
              </div>
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12px] text-text-primary font-mono hover:text-accent-blue transition-colors"
                  title="Open on block explorer"
                >
                  {shortAddr(token.contractAddress)}
                </a>
              ) : (
                <span className="text-[12px] text-text-primary font-mono">
                  {shortAddr(token.contractAddress)}
                </span>
              )}
            </div>
          </Cell>

          {/* Network */}
          <Cell>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[13px] font-bold bg-bg-elevated border border-border text-text-primary">
              {token.chain}
            </span>
          </Cell>

          {/* CEX Price + GATE link below */}
          <Cell>
            {(() => {
              const dp = getCexDirectionalPrice(token);
              return (
                <div className="flex flex-col items-end leading-tight">
                  <div className="flex items-baseline gap-1.5 justify-end">
                    {dp.action && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${dp.colorClass}`}
                      >
                        {dp.action}
                      </span>
                    )}
                    <span className={`text-[14px] font-semibold ${dp.colorClass}`}>
                      {formatPrice(dp.price)}
                    </span>
                  </div>
                  <a
                    href={`https://www.gate.io/trade/${token.pair}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] font-semibold text-text-primary hover:text-accent-green transition-colors uppercase whitespace-nowrap"
                    title="Open trading pair on Gate.io"
                  >
                    GATE ↗
                  </a>
                </div>
              );
            })()}
          </Cell>

          {/* DEX Price + DEX-name link below (прямая ссылка на биржу) */}
          <Cell>
            {(() => {
              const dp = getDexDirectionalPrice(token);
              return (
                <div className="flex flex-col items-end leading-tight">
                  <div className="flex items-baseline gap-1.5 justify-end">
                    {dp.action && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${dp.colorClass}`}
                      >
                        {dp.action}
                      </span>
                    )}
                    <span className={`text-[14px] font-semibold ${dp.colorClass}`}>
                      {formatPrice(dp.price)}
                    </span>
                  </div>
                  <a
                    href={dexDisplay.useSwapUrl ? dexSwapUrl : token.dexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[14px] font-semibold text-text-primary hover:text-accent-blue transition-colors uppercase whitespace-nowrap"
                    title={`Open ${dexDisplay.name}`}
                  >
                    {dexDisplay.name} ↗
                  </a>
                </div>
              );
            })()}
          </Cell>

          {/* CEX Ask/Bid */}
          <Cell>
            <div className="flex flex-col leading-tight">
              <span className="text-[12px] text-accent-green">
                {formatPrice(token.cexAsk)}
              </span>
              <span className="text-[12px] text-accent-red">
                {formatPrice(token.cexBid)}
              </span>
            </div>
          </Cell>

          {/* DEX Ask/Bid */}
          <Cell>
            <div className="flex flex-col leading-tight">
              <span className="text-[12px] text-accent-green">
                {formatPrice(token.dexAsk)}
              </span>
              <span className="text-[12px] text-accent-red">
                {formatPrice(token.dexBid)}
              </span>
            </div>
          </Cell>

          {/* DEX Liquidity */}
          <Cell>
            <span className="text-[14px] text-text-primary font-semibold">
              {formatUsd(token.dexLiquidityUsd, { compact: true })}
            </span>
          </Cell>

          {/* Spread */}
          <Cell>
            <span
              className={`text-[14px] font-bold ${
                spread > 0 ? "text-accent-green" : "text-accent-red"
              }`}
            >
              {formatPercent(spread)}
            </span>
          </Cell>

          {/* Profit */}
          <Cell>
            <span
              className={`text-[14px] font-bold ${
                profitable ? "text-accent-green" : "text-text-primary opacity-70"
              }`}
            >
              {formatProfit(profit)}
            </span>
          </Cell>

          {/* Direction */}
          <Cell>
            <DirectionBadge direction={direction} />
          </Cell>

          {/* Close button (без border-r, как и Selected token аналогично без border-l) */}
          <div className="flex items-center pl-4 pr-4">
            <button
              onClick={onClear}
              className="group inline-flex items-center justify-center w-9 h-9 rounded border border-border text-text-secondary hover:bg-accent-red hover:border-accent-red hover:text-bg transition-colors"
              title="Unpin selected token"
              aria-label="Unpin"
            >
              <span className="text-[27px] leading-none">×</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Ячейка-разделитель: горизонтальный padding + правый бордюр.
 * Эквивалент `<td>` в таблице результатов.
 */
function Cell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center px-4 border-r border-border">
      {children}
    </div>
  );
}

function DirectionBadge({
  direction,
}: {
  direction: ScanResult["bestDirection"];
}) {
  if (direction === "DEX_TO_CEX") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[13px] font-semibold bg-accent-green-bg text-accent-green border border-accent-green/30 whitespace-nowrap">
        DEX → CEX
      </span>
    );
  }
  if (direction === "CEX_TO_DEX") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[13px] font-semibold bg-accent-red-bg text-accent-red border border-accent-red/30 whitespace-nowrap">
        CEX → DEX
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[13px] font-semibold bg-bg-elevated text-text-primary border border-border">
      —
    </span>
  );
}

/**
 * Имя для отображения в колонке DEX Price.
 * Если dexId выглядит как имя биржи — показываем его как есть.
 * Иначе — DEXSCREENER (с ссылкой на агрегатор).
 */
function getDexDisplayName(dexId: string): {
  name: string;
  useSwapUrl: boolean;
} {
  const id = (dexId || "").trim();
  if (!id) return { name: "DEXSCREENER", useSwapUrl: false };
  if (/^0x[0-9a-f]{40}$/i.test(id)) return { name: "DEXSCREENER", useSwapUrl: false };
  if (id.length > 24) return { name: "DEXSCREENER", useSwapUrl: false };
  if (/^[0-9a-f]+$/i.test(id) && id.length >= 16)
    return { name: "DEXSCREENER", useSwapUrl: false };
  return { name: id, useSwapUrl: true };
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Направленная цена для отображения в колонке CEX Price.
 * Логика идентична таблице результатов:
 *   - DEX_TO_CEX: продаём на CEX → bid → SELL красный
 *   - CEX_TO_DEX: покупаем на CEX → ask → BUY зелёный
 *   - NONE: mid, без подписи
 */
type DirectionalPrice = {
  price: number;
  action: "BUY" | "SELL" | null;
  colorClass: string;
};

function getCexDirectionalPrice(row: ScanResult): DirectionalPrice {
  if (row.bestDirection === "DEX_TO_CEX") {
    return { price: row.cexBid, action: "SELL", colorClass: "text-accent-red" };
  }
  if (row.bestDirection === "CEX_TO_DEX") {
    return { price: row.cexAsk, action: "BUY", colorClass: "text-accent-green" };
  }
  return { price: row.cexMid, action: null, colorClass: "text-text-primary" };
}

function getDexDirectionalPrice(row: ScanResult): DirectionalPrice {
  if (row.bestDirection === "DEX_TO_CEX") {
    return { price: row.dexAsk, action: "BUY", colorClass: "text-accent-green" };
  }
  if (row.bestDirection === "CEX_TO_DEX") {
    return { price: row.dexBid, action: "SELL", colorClass: "text-accent-red" };
  }
  return { price: row.dexPrice, action: null, colorClass: "text-text-primary" };
}
