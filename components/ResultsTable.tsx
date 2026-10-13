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

interface ResultsTableProps {
  results: ScanResult[];
  loading: boolean;
  whitelist: string[];
  /** key токена, закреплённого в Filters (для подсветки строки) */
  pinnedKey: string | null;
  /** Клик по строке — закрепляет токен и подсвечивает её */
  onPin: (row: ScanResult) => void;
}

export default function ResultsTable({
  results,
  loading,
  whitelist,
  pinnedKey,
  onPin,
}: ResultsTableProps) {
  // Set для O(1) проверки whitelist
  const whitelistSet = new Set(whitelist.map((x) => x.toUpperCase()));

  if (loading && results.length === 0) {
    return <LoadingState />;
  }
  if (!loading && results.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="mx-auto w-full max-w-[1488px] px-6 pb-8">
      <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[17px] border-collapse">
            <thead>
              <tr className="bg-bg-elevated">
                <Th>#</Th>
                <Th>Token</Th>
                <Th>Network</Th>
                <Th right>CEX Price</Th>
                <Th right>CEX Ask / Bid</Th>
                <Th right>DEX Price</Th>
                <Th right>DEX Ask / Bid</Th>
                <Th right>DEX Liquidity</Th>
                <Th right>Spread</Th>
                <Th right>Profit</Th>
                <Th center>Direction</Th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, idx) => {
                const key = `${r.pair}-${r.chain}-${r.contractAddress}`;
                const isWhitelisted = whitelistSet.has(r.symbol.toUpperCase());
                return (
                  <Row
                    key={key}
                    row={r}
                    index={idx}
                    selected={pinnedKey === key}
                    whitelisted={isWhitelisted}
                    onSelect={() => onPin(r)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  right,
  center,
}: {
  children: React.ReactNode;
  right?: boolean;
  center?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 text-[13px] font-semibold uppercase tracking-wider text-text-primary whitespace-nowrap border-b border-r border-border last:border-r-0 ${
        right ? "text-right" : center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Row({
  row,
  index,
  selected,
  whitelisted,
  onSelect,
}: {
  row: ScanResult;
  index: number;
  selected: boolean;
  whitelisted: boolean;
  onSelect: () => void;
}) {
  const profit = row.bestProfit;
  const spread = row.bestSpread;
  const profitable = profit > 0;

  const explorerUrl = getExplorerUrl(row.chain, row.contractAddress);
  const cmcUrl = `https://coinmarketcap.com/currencies/${row.symbol.toLowerCase()}/`;

  // Базовые классы строки + ховер + выделение
  // Приоритет: selected (синий) > whitelisted (зелёный) > обычный (синий ховер)
  const rowClass = [
    "row-hover cursor-pointer transition-colors",
    selected
      ? "bg-accent-blue/25 hover:bg-accent-blue/30"
      : whitelisted
        ? "bg-accent-green/10 hover:bg-accent-green/20"
        : "hover:bg-accent-blue/10",
  ].join(" ");

  // Базовые классы ячеек: бордюр снизу + справа, у последней колонки бордюр справа убираем
  // У выбранной строки слева добавим тонкую цветную полосу через первую ячейку
  const tdBase =
    "px-4 py-3 border-b border-r border-border last:border-r-0 align-middle";

  // Чтобы клики по ссылкам внутри строки не вызывали onSelect — будем останавливать
  // распространение события на самом <a>/<button>. Реализуем компонент-обёртку:
  return (
    <tr className={rowClass} onClick={onSelect}>
      {/* # с цветной полосой для выделенной строки */}
      <td
        className={`${tdBase} text-text-primary font-semibold text-[14px] relative ${
          selected ? "text-accent-blue" : ""
        }`}
      >
        {selected && (
          <span className="absolute left-0 top-0 bottom-0 w-[5px] bg-accent-blue" />
        )}
        {index + 1}
      </td>

      {/* Token: ticker (CMC) + copy icons + contract (explorer) */}
      <td className={tdBase}>
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-2">
            <a
              href={cmcUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopPropagation}
              className="font-bold text-text-primary hover:text-accent-green transition-colors"
              title="Open on CoinMarketCap"
            >
              {row.symbol}
            </a>
            <a
              href={row.dexUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopPropagation}
              className="inline-flex items-center justify-center w-[18px] h-[18px] leading-none text-text-primary opacity-50 hover:opacity-100 hover:text-accent-blue transition-colors"
              title="Open pool on DexScreener"
              aria-label="Open on DexScreener"
            >
              <span className="text-[14px]">⧉</span>
            </a>
            {row.contractAddress && (
              <CopyButton
                text={row.contractAddress}
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
              onClick={stopPropagation}
              className="text-[14px] text-text-primary font-semibold hover:text-accent-blue transition-colors font-mono"
              title="Open on block explorer"
            >
              {shortAddr(row.contractAddress)}
            </a>
          ) : (
            <span className="text-[14px] text-text-primary font-semibold font-mono">
              {shortAddr(row.contractAddress)}
            </span>
          )}
        </div>
      </td>

      {/* Network: badge link to explorer */}
      <td className={tdBase}>
        {explorerUrl ? (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={stopPropagation}
            className="inline-flex items-center px-2 py-0.5 rounded text-[19px] font-bold bg-bg-elevated border border-border text-text-primary hover:border-accent-blue hover:text-accent-blue transition-colors"
            title="Open contract on block explorer"
          >
            {row.chain}
          </a>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[19px] font-bold bg-bg-elevated border border-border text-text-primary">
            {row.chain}
          </span>
        )}
      </td>

      {/* CEX Price (directional: bid if SELL, ask if BUY, mid if NONE) + link to Gate */}
      <td className={`${tdBase} text-right`}>
        {(() => {
          const dp = getCexDirectionalPrice(row);
          return (
            <div className="flex flex-col items-end leading-tight">
              <div className="flex items-baseline gap-1.5 justify-end">
                {dp.action && (
                  <span
                    className={`text-[12px] font-bold uppercase tracking-wider ${dp.colorClass}`}
                  >
                    {dp.action}
                  </span>
                )}
                <span className={dp.colorClass}>{formatPrice(dp.price)}</span>
              </div>
              <a
                href={`https://www.gate.io/trade/${row.pair}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stopPropagation}
                className="inline-flex items-center gap-1 text-[14px] font-semibold text-text-primary hover:text-accent-green transition-colors uppercase"
                title="Open trading pair on Gate.io"
              >
                <span>GATE</span>
                <span className="text-[14px] opacity-70" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          );
        })()}
      </td>

      {/* CEX Ask/Bid — Ask наверху (BUY=green), Bid снизу (SELL=red) */}
      <td className={`${tdBase} text-right`}>
        <div className="flex flex-col items-end leading-tight">
          <span
            className="text-accent-green text-[14px]"
            title="Ask (you buy at this price)"
          >
            {formatPrice(row.cexAsk)}
          </span>
          <span
            className="text-accent-red text-[14px]"
            title="Bid (you sell at this price)"
          >
            {formatPrice(row.cexBid)}
          </span>
        </div>
      </td>

      {/* DEX Price (directional) + direct swap link */}
      <td className={`${tdBase} text-right`}>
        {(() => {
          const dp = getDexDirectionalPrice(row);
          const swapUrl =
            getDexSwapUrl(
              row.dexId,
              row.dexChainId,
              row.contractAddress,
              row.dexPairAddress
            ) ?? row.dexUrl;
          return (
            <div className="flex flex-col items-end leading-tight">
              <div className="flex items-baseline gap-1.5 justify-end">
                {dp.action && (
                  <span
                    className={`text-[12px] font-bold uppercase tracking-wider ${dp.colorClass}`}
                  >
                    {dp.action}
                  </span>
                )}
                <span className={dp.colorClass}>{formatPrice(dp.price)}</span>
              </div>
              {(() => {
                const display = getDexDisplayName(row.dexId);
                // Если dexId выглядит как имя биржи — ведём на свап (или его fallback);
                // если dexId «мусорный» — ведём на агрегатор DexScreener.
                const href = display.useSwapUrl ? swapUrl : row.dexUrl;
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={stopPropagation}
                    className="inline-flex items-center gap-1 text-[14px] font-semibold text-text-primary hover:text-accent-blue transition-colors uppercase"
                    title={`Open ${display.name}`}
                  >
                    <span>{display.name}</span>
                    <span
                      className="text-[14px] opacity-70"
                      aria-hidden="true"
                    >
                      ↗
                    </span>
                  </a>
                );
              })()}
            </div>
          );
        })()}
      </td>

      {/* DEX Ask/Bid (effective with slippage + fee) — Ask=BUY=green, Bid=SELL=red */}
      <td className={`${tdBase} text-right`}>
        <div className="flex flex-col items-end leading-tight">
          <span
            className="text-accent-green text-[14px]"
            title="Effective buy price (with slippage & pool fee)"
          >
            {formatPrice(row.dexAsk)}
          </span>
          <span
            className="text-accent-red text-[14px]"
            title="Effective sell price (with slippage & pool fee)"
          >
            {formatPrice(row.dexBid)}
          </span>
        </div>
      </td>

      {/* DEX Liquidity */}
      <td
        className={`${tdBase} text-right text-text-primary font-semibold`}
      >
        {formatUsd(row.dexLiquidityUsd, { compact: true })}
      </td>

      {/* Spread */}
      <td className={`${tdBase} text-right`}>
        <span
          className={`font-bold ${
            spread > 0 ? "text-accent-green" : "text-accent-red"
          }`}
        >
          {formatPercent(spread)}
        </span>
      </td>

      {/* Profit */}
      <td className={`${tdBase} text-right`}>
        <span
          className={`font-bold ${
            profitable ? "text-accent-green" : "text-text-primary opacity-70"
          }`}
        >
          {formatProfit(profit)}
        </span>
      </td>

      {/* Direction */}
      <td className={`${tdBase} text-center`}>
        <DirectionBadge direction={row.bestDirection} />
      </td>
    </tr>
  );
}

/**
 * Останавливает всплытие клика, чтобы клик по ссылке/кнопке внутри строки
 * не триггерил выделение всей строки.
 */
function stopPropagation(e: React.MouseEvent) {
  e.stopPropagation();
}

function DirectionBadge({
  direction,
}: {
  direction: ScanResult["bestDirection"];
}) {
  if (direction === "DEX_TO_CEX") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded text-[19px] font-semibold bg-accent-green-bg text-accent-green border border-accent-green/30 whitespace-nowrap">
        DEX → CEX
      </span>
    );
  }
  if (direction === "CEX_TO_DEX") {
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded text-[19px] font-semibold bg-accent-red-bg text-accent-red border border-accent-red/30 whitespace-nowrap">
        CEX → DEX
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-3 py-1 rounded text-[19px] font-semibold bg-bg-elevated text-text-primary border border-border">
      —
    </span>
  );
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Возвращает имя для показа в колонке DEX Price.
 * Если dexId — нормальное имя биржи (uniswap, pancakeswap, sushi и т.д.) —
 * показываем его как есть. Если dexId выглядит как адрес контракта или
 * непонятный идентификатор пула — показываем "DEXSCREENER" и ведём на
 * родительский dexscreener-URL вместо прямого свапа.
 */
function getDexDisplayName(dexId: string): {
  name: string;
  useSwapUrl: boolean;
} {
  const id = (dexId || "").trim();
  if (!id) return { name: "DEXSCREENER", useSwapUrl: false };
  // 1. Адрес EVM (0x + 40 hex)
  if (/^0x[0-9a-f]{40}$/i.test(id)) {
    return { name: "DEXSCREENER", useSwapUrl: false };
  }
  // 2. Подозрительно длинный hex/base58 (вряд ли это имя биржи)
  if (id.length > 24) {
    return { name: "DEXSCREENER", useSwapUrl: false };
  }
  // 3. Только hex и >= 16 символов — скорее всего ID пула
  if (/^[0-9a-f]+$/i.test(id) && id.length >= 16) {
    return { name: "DEXSCREENER", useSwapUrl: false };
  }
  // Иначе считаем это нормальным именем DEX
  return { name: id, useSwapUrl: true };
}

/**
 * Возвращает цену + действие (BUY/SELL) для отображения в колонках
 * "CEX Price" и "DEX Price" в зависимости от направления арбитража.
 *
 * Если bestDirection = NONE — показываем mid/spot как справочные значения.
 */
type DirectionalPrice = {
  price: number;
  /** "BUY" — мы покупаем здесь | "SELL" — мы продаём здесь | null — справочно */
  action: "BUY" | "SELL" | null;
  /** Цвет: red для BUY, green для SELL, primary для null */
  colorClass: string;
};

function getCexDirectionalPrice(row: ScanResult): DirectionalPrice {
  if (row.bestDirection === "DEX_TO_CEX") {
    // На CEX продаём → bid (SELL = красный по новой логике пользователя)
    return { price: row.cexBid, action: "SELL", colorClass: "text-accent-red" };
  }
  if (row.bestDirection === "CEX_TO_DEX") {
    // На CEX покупаем → ask (BUY = зелёный)
    return { price: row.cexAsk, action: "BUY", colorClass: "text-accent-green" };
  }
  return { price: row.cexMid, action: null, colorClass: "text-text-primary" };
}

function getDexDirectionalPrice(row: ScanResult): DirectionalPrice {
  if (row.bestDirection === "DEX_TO_CEX") {
    // На DEX покупаем → ask (BUY = зелёный)
    return { price: row.dexAsk, action: "BUY", colorClass: "text-accent-green" };
  }
  if (row.bestDirection === "CEX_TO_DEX") {
    // На DEX продаём → bid (SELL = красный)
    return { price: row.dexBid, action: "SELL", colorClass: "text-accent-red" };
  }
  return { price: row.dexPrice, action: null, colorClass: "text-text-primary" };
}

function LoadingState() {
  return (
    <div className="mx-auto w-full max-w-[1488px] px-6 pb-8">
      <div className="rounded-xl border border-border bg-bg-card p-12 text-center">
        <div className="inline-flex items-center gap-3 text-text-primary font-semibold">
          <div className="w-5 h-5 border-2 border-accent-green border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold">
            Scanning Gate.io & DexScreener...
          </span>
        </div>
        <p className="text-text-primary font-semibold opacity-60 text-[14px] mt-3">
          First scan may take 1–2 minutes. Subsequent updates are cached.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto w-full max-w-[1488px] px-6 pb-8">
      <div className="rounded-xl border border-border border-dashed bg-bg-card p-12 text-center">
        <div className="text-4xl mb-3 opacity-30">∅</div>
        <p className="text-text-primary font-semibold">
          No arbitrage opportunities match your filters
        </p>
        <p className="text-text-primary font-semibold opacity-60 text-[14px] mt-2">
          Try lowering the minimum spread or changing the network filter.
        </p>
      </div>
    </div>
  );
}
