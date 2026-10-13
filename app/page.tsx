"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import Filters from "@/components/Filters";
import ResultsTable from "@/components/ResultsTable";
import StrategyModal from "@/components/StrategyModal";
import { recalcForAmount } from "@/lib/arbitrage";
import type { ScanResult, TradeAmount } from "@/types";
import type { StrategyDirection } from "@/types/strategy";

interface ScanResponse {
  ok: boolean;
  results: ScanResult[];
  lastScan: number;
  cacheAge: number;
  fromCache: boolean;
  scanInProgress: boolean;
  scanProgress: { done: number; total: number };
  errors: string[];
  error?: string;
}

export default function HomePage() {
  // Server data
  const [results, setResults] = useState<ScanResult[]>([]);
  const [lastScan, setLastScan] = useState(0);
  const [scanInProgress, setScanInProgress] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);

  // Filters
  const [tradeAmount, setTradeAmount] = useState<TradeAmount>(100);
  const [minSpread, setMinSpread] = useState(1);
  const [minLiquidity, setMinLiquidity] = useState(50_000);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(60_000); // 1m по умолчанию
  const [direction, setDirection] = useState<"ALL" | "DEX_TO_CEX" | "CEX_TO_DEX">("ALL");
  const [chains, setChains] = useState<string[]>(["ALL"]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  // Закреплённый токен — снапшот строки на момент клика в таблице.
  // Без persistence: при перезагрузке страницы обнуляется.
  const [pinnedToken, setPinnedToken] = useState<ScanResult | null>(null);

  const handlePin = useCallback((row: ScanResult) => {
    // Снапшот: создаём новый объект, чтобы изменения в results
    // не модифицировали закреплённую копию.
    setPinnedToken({ ...row });
  }, []);

  const handlePinClear = useCallback(() => {
    setPinnedToken(null);
  }, []);

  // Strategy modal
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [strategyDirection, setStrategyDirection] =
    useState<StrategyDirection>("CEX_TO_DEX");

  const handleOpenStrategy = useCallback((direction: StrategyDirection) => {
    setStrategyDirection(direction);
    setStrategyOpen(true);
  }, []);

  const handleCloseStrategy = useCallback(() => {
    setStrategyOpen(false);
  }, []);

  // Флаг что мы загрузили данные из localStorage.
  // Без него save useEffect срабатывает с initial state ([]) сразу после
  // монтирования и затирает реальные данные из localStorage до того,
  // как load useEffect успеет применить их к state.
  const hydratedRef = useRef(false);

  // Загружаем blacklist/whitelist из localStorage только на клиенте (избегаем SSR mismatch)
  useEffect(() => {
    try {
      const rawB = localStorage.getItem("p2p-blacklist");
      if (rawB) {
        const arr = JSON.parse(rawB);
        if (Array.isArray(arr)) {
          setBlacklist(arr.filter((x) => typeof x === "string"));
        }
      }
      const rawW = localStorage.getItem("p2p-whitelist");
      if (rawW) {
        const arr = JSON.parse(rawW);
        if (Array.isArray(arr)) {
          setWhitelist(arr.filter((x) => typeof x === "string"));
        }
      }
    } catch {
      /* ignore */
    } finally {
      // Помечаем что hydration завершилась.
      // Только после этого save useEffect-ы будут писать в localStorage.
      hydratedRef.current = true;
    }
  }, []);

  // Сохраняем при изменении (но только после того как загрузились)
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem("p2p-blacklist", JSON.stringify(blacklist));
    } catch {
      /* ignore */
    }
  }, [blacklist]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem("p2p-whitelist", JSON.stringify(whitelist));
    } catch {
      /* ignore */
    }
  }, [whitelist]);

  // Возвращает сообщение об ошибке либо null если успешно.
  // Запрещаем добавление в blacklist если токен уже в whitelist (и наоборот).
  const handleBlacklistAdd = useCallback(
    (ticker: string): string | null => {
      const t = ticker.trim().toUpperCase();
      if (!t) return "Empty ticker";
      if (whitelist.includes(t)) {
        return `Token "${t}" is already in Whitelist. Remove it from Whitelist first.`;
      }
      setBlacklist((prev) => (prev.includes(t) ? prev : [...prev, t]));
      return null;
    },
    [whitelist]
  );

  const handleBlacklistRemove = useCallback((ticker: string) => {
    setBlacklist((prev) => prev.filter((x) => x !== ticker));
  }, []);

  const handleWhitelistAdd = useCallback(
    (ticker: string): string | null => {
      const t = ticker.trim().toUpperCase();
      if (!t) return "Empty ticker";
      if (blacklist.includes(t)) {
        return `Token "${t}" is already in Blacklist. Remove it from Blacklist first.`;
      }
      setWhitelist((prev) => (prev.includes(t) ? prev : [...prev, t]));
      return null;
    },
    [blacklist]
  );

  const handleWhitelistRemove = useCallback((ticker: string) => {
    setWhitelist((prev) => prev.filter((x) => x !== ticker));
  }, []);

  const inFlightRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScan = useCallback(
    async (force = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        // tradeAmount применяется на клиенте через recalcForAmount,
        // поэтому здесь его передавать не нужно. Сервер считает базовые
        // значения один раз и кэширует их.
        const url = `/api/scan${force ? "?force=1" : ""}`;
        const res = await fetch(url, { cache: "no-store" });
        const data: ScanResponse = await res.json();
        if (data.ok) {
          setResults(data.results || []);
          setLastScan(data.lastScan || 0);
          setScanInProgress(data.scanInProgress);
          setScanProgress(data.scanProgress);
          setError(null);
        } else {
          setError(data.error || "Unknown error");
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        inFlightRef.current = false;
        setInitialLoad(false);
      }
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    fetchScan(false);
  }, [fetchScan]);

  // Polling по интервалу из настроек
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      fetchScan(false);
    }, refreshIntervalMs);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchScan, refreshIntervalMs]);

  // Если идёт скан — поллим чаще, чтобы видеть прогресс
  useEffect(() => {
    if (!scanInProgress) return;
    const t = setInterval(() => fetchScan(false), 3000);
    return () => clearInterval(t);
  }, [scanInProgress, fetchScan]);

  const handleManualRefresh = useCallback(() => {
    fetchScan(true);
  }, [fetchScan]);

  // Available chains для фильтра
  const availableChains = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) set.add(r.chain);
    return Array.from(set).sort();
  }, [results]);

  // Тикеры всех токенов, по которым сейчас есть данные в скане.
  // Используется для подсветки "активных" токенов в Whitelist.
  const activeSymbols = useMemo(() => {
    const set = new Set<string>();
    for (const r of results) set.add(r.symbol.toUpperCase());
    return set;
  }, [results]);

  // Применяем фильтры (с пересчётом spread/profit под текущий tradeAmount)
  const filtered = useMemo(() => {
    const blacklistSet = new Set(blacklist.map((x) => x.toUpperCase()));
    // chains == ["ALL"] или [] => фильтр не применяется (показываем всё)
    const isAllChains =
      chains.length === 0 || (chains.length === 1 && chains[0] === "ALL");
    const chainsSet = isAllChains ? null : new Set(chains);
    return results
      .map((r) => recalcForAmount(r, tradeAmount))
      .filter((r) => {
        // Blacklist (по тикеру)
        if (blacklistSet.has(r.symbol.toUpperCase())) return false;
        // Direction
        if (direction !== "ALL" && r.bestDirection !== direction) return false;
        // Min spread
        if (r.bestSpread < minSpread) return false;
        // Min DEX Liquidity (отсекаем малоликвидные пулы)
        if (r.dexLiquidityUsd < minLiquidity) return false;
        // Chains (multi-select)
        if (chainsSet && !chainsSet.has(r.chain)) return false;
        return true;
      })
      // Сортируем по убыванию лучшего спреда (после пересчёта порядок может измениться)
      .sort((a, b) => b.bestSpread - a.bestSpread);
  }, [
    results,
    direction,
    minSpread,
    minLiquidity,
    chains,
    blacklist,
    tradeAmount,
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        lastScan={lastScan}
        scanInProgress={scanInProgress}
        scanProgress={scanProgress}
        resultCount={filtered.length}
        onRefresh={handleManualRefresh}
        onOpenStrategy={handleOpenStrategy}
      />

      <Filters
        tradeAmount={tradeAmount}
        onTradeAmountChange={setTradeAmount}
        minSpread={minSpread}
        onMinSpreadChange={setMinSpread}
        minLiquidity={minLiquidity}
        onMinLiquidityChange={setMinLiquidity}
        refreshIntervalMs={refreshIntervalMs}
        onRefreshIntervalChange={setRefreshIntervalMs}
        direction={direction}
        onDirectionChange={setDirection}
        chains={chains}
        onChainsChange={setChains}
        availableChains={availableChains}
        blacklist={blacklist}
        onBlacklistAdd={handleBlacklistAdd}
        onBlacklistRemove={handleBlacklistRemove}
        whitelist={whitelist}
        onWhitelistAdd={handleWhitelistAdd}
        onWhitelistRemove={handleWhitelistRemove}
        activeSymbols={activeSymbols}
        pinnedToken={pinnedToken}
        onPinnedClear={handlePinClear}
      />

      {error && (
        <div className="mx-auto w-full max-w-[1488px] px-6 pb-2">
          <div className="rounded-lg border border-accent-red/30 bg-accent-red-bg px-4 py-2 text-sm text-accent-red">
            ⚠ {error}
          </div>
        </div>
      )}

      <ResultsTable
        results={filtered}
        loading={initialLoad && results.length === 0}
        whitelist={whitelist}
        pinnedKey={
          pinnedToken
            ? `${pinnedToken.pair}-${pinnedToken.chain}-${pinnedToken.contractAddress}`
            : null
        }
        onPin={handlePin}
      />

      <footer className="mt-auto border-t border-border py-6">
        <div className="mx-auto w-full max-w-[1488px] px-6 flex flex-wrap items-center justify-between gap-3 text-[11px] text-text-primary font-semibold">
          <div>
            Data: <span className="text-text-secondary">Gate.io REST v4</span> +{" "}
            <span className="text-text-secondary">DexScreener API</span>
          </div>
          <div>
            DEX prices include estimated slippage. Always verify on the exchange before trading.
          </div>
        </div>
      </footer>

      <StrategyModal
        open={strategyOpen}
        direction={strategyDirection}
        pinnedToken={pinnedToken}
        tradeAmount={tradeAmount}
        onClose={handleCloseStrategy}
      />
    </div>
  );
}
