import {
  getCurrencies,
  getTickers,
  getOrderBook,
  bestPriceFromOrderBook,
  gateChainToDexScreener,
} from "./gate";
import { getPairsBatched, pickBestPool } from "./dexscreener";
import { calculateArbitrage } from "./arbitrage";
import type {
  ScanResult,
  TokenInfo,
  TradeAmount,
  GateCurrency,
  GateTicker,
} from "@/types";

/**
 * In-memory кэш для последнего скана.
 * В продакшене лучше Redis, но для MVP хватит.
 */
interface CacheState {
  results: ScanResult[];
  lastScan: number;
  scanInProgress: boolean;
  scanProgress: { done: number; total: number };
  currentTradeAmount: TradeAmount;
  errors: string[];
}

const cache: CacheState = {
  results: [],
  lastScan: 0,
  scanInProgress: false,
  scanProgress: { done: 0, total: 0 },
  currentTradeAmount: 1000,
  errors: [],
};

/** Сколько токенов CEX обрабатываем параллельно при запросах к стакану */
const CEX_CONCURRENCY = 10;

/** Минимальный 24h объём пары на Gate (USDT), чтобы вообще её рассматривать */
const MIN_CEX_VOLUME_USDT = 5000;

/**
 * Шаг 1. Готовим список токенов с Gate:
 * - все USDT-пары
 * - с указанием сети, поддерживаемой DexScreener
 * - с непустым адресом контракта
 * - объём за 24ч > MIN_CEX_VOLUME_USDT
 */
async function prepareGateTokens(): Promise<
  Array<{
    pair: string;
    symbol: string;
    chain: string;
    dexChainId: string;
    contractAddress: string;
    volume24h: number;
  }>
> {
  const [currencies, tickers] = await Promise.all([
    getCurrencies(),
    getTickers(),
  ]);

  // Map: currency symbol -> chains info
  const currencyMap = new Map<string, GateCurrency>();
  for (const c of currencies) {
    if (c.delisted) continue;
    currencyMap.set(c.currency, c);
  }

  // Map: pair -> ticker
  const tickerMap = new Map<string, GateTicker>();
  for (const t of tickers) {
    tickerMap.set(t.currency_pair, t);
  }

  const result: Array<{
    pair: string;
    symbol: string;
    chain: string;
    dexChainId: string;
    contractAddress: string;
    volume24h: number;
  }> = [];

  // Пробегаем по всем валютам
  for (const [symbol, cur] of currencyMap.entries()) {
    if (symbol === "USDT") continue; // не сравниваем сам USDT
    const pair = `${symbol}_USDT`;
    const ticker = tickerMap.get(pair);
    if (!ticker) continue;

    const volume = parseFloat(ticker.quote_volume) || 0;
    if (volume < MIN_CEX_VOLUME_USDT) continue;

    const chains = cur.chains ?? [];
    for (const ch of chains) {
      const addr = ch.contract_address || ch.addr || "";
      // Пропускаем, если адреса нет вообще (например, нативные токены сети)
      if (!addr) continue;
      const dexChainId = gateChainToDexScreener(ch.name);
      if (!dexChainId) continue;
      // Пропускаем, если и депозит, и вывод заблокированы (мёртвая сеть)
      if (ch.deposit_disabled && ch.withdraw_disabled) continue;

      result.push({
        pair,
        symbol,
        chain: ch.name,
        dexChainId,
        contractAddress: addr,
        volume24h: volume,
      });
    }
  }

  // Сортируем по убыванию объёма — приоритет ликвидным
  result.sort((a, b) => b.volume24h - a.volume24h);
  return result;
}

/**
 * Шаг 2. Получаем стаканы для CEX-токенов параллельно (с лимитом).
 */
async function fetchCexOrderBooks(
  tokens: Awaited<ReturnType<typeof prepareGateTokens>>,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, { bid: number; ask: number }>> {
  // Уникальные пары (один токен может быть в нескольких сетях, но пара одна)
  const uniquePairs = Array.from(new Set(tokens.map((t) => t.pair)));
  const result = new Map<string, { bid: number; ask: number }>();
  let done = 0;

  // Простая семафорная очередь
  let i = 0;
  async function worker() {
    while (i < uniquePairs.length) {
      const idx = i++;
      const pair = uniquePairs[idx];
      try {
        const ob = await getOrderBook(pair, 5);
        const px = bestPriceFromOrderBook(ob);
        if (px) result.set(pair, px);
      } catch (err) {
        // Тихо пропускаем — это часто из-за делистнутых пар
      }
      done++;
      if (onProgress && done % 20 === 0) {
        onProgress(done, uniquePairs.length);
      }
    }
  }

  await Promise.all(
    Array.from({ length: CEX_CONCURRENCY }, () => worker())
  );
  if (onProgress) onProgress(uniquePairs.length, uniquePairs.length);
  return result;
}

/**
 * Главный публичный метод: запустить полный скан.
 */
export async function runScan(tradeAmount: TradeAmount): Promise<{
  results: ScanResult[];
  errors: string[];
}> {
  if (cache.scanInProgress) {
    return { results: cache.results, errors: cache.errors };
  }
  cache.scanInProgress = true;
  cache.scanProgress = { done: 0, total: 0 };
  cache.currentTradeAmount = tradeAmount;
  cache.errors = [];

  try {
    // 1. Готовим список токенов
    const tokens = await prepareGateTokens();
    cache.scanProgress.total = tokens.length * 2; // CEX + DEX этапы

    // 2. Получаем стаканы CEX
    const orderBooks = await fetchCexOrderBooks(tokens, (done, total) => {
      cache.scanProgress.done = done;
    });

    // 3. Готовим TokenInfo с реальными bid/ask
    const tokenInfos: TokenInfo[] = [];
    for (const t of tokens) {
      const px = orderBooks.get(t.pair);
      if (!px) continue;
      tokenInfos.push({
        symbol: t.symbol,
        pair: t.pair,
        chain: t.chain,
        contractAddress: t.contractAddress,
        cexBid: px.bid,
        cexAsk: px.ask,
        cexVolume24h: t.volume24h,
      });
    }

    // 4. Дёргаем DexScreener батчами по адресам
    const addresses = tokenInfos.map((t) => t.contractAddress);
    const dexMap = await getPairsBatched(addresses, {
      onProgress: (done, total) => {
        cache.scanProgress.done = tokens.length + done;
      },
    });

    // 5. Считаем арбитраж для каждого токена/сети
    const results: ScanResult[] = [];
    for (const t of tokenInfos) {
      const pairs = dexMap.get(t.contractAddress.toLowerCase()) ?? [];
      const dexChainId = gateChainToDexScreener(t.chain);
      if (!dexChainId) continue;
      const bestPool = pickBestPool(pairs, dexChainId);
      if (!bestPool) continue;

      try {
        const r = calculateArbitrage(t, bestPool, tradeAmount);
        if (isFinite(r.bestSpread) && isFinite(r.bestProfit)) {
          results.push(r);
        }
      } catch (err) {
        cache.errors.push(`${t.pair}/${t.chain}: ${(err as Error).message}`);
      }
    }

    // 6. Сортируем по убыванию лучшего спреда
    results.sort((a, b) => b.bestSpread - a.bestSpread);

    cache.results = results;
    cache.lastScan = Date.now();
    return { results, errors: cache.errors };
  } finally {
    cache.scanInProgress = false;
  }
}

export function getCachedScan(): {
  results: ScanResult[];
  lastScan: number;
  scanInProgress: boolean;
  scanProgress: { done: number; total: number };
  errors: string[];
} {
  return {
    results: cache.results,
    lastScan: cache.lastScan,
    scanInProgress: cache.scanInProgress,
    scanProgress: cache.scanProgress,
    errors: cache.errors,
  };
}
