// Динамические gas-цены через Owlracle API + Solana хардкод.
// Используется и в /api/gas (UI), и в lib/strategy.ts (расчёт стратегии).

const OWLRACLE_BASE = "https://api.owlracle.info/v4";

/** Маппинг наших chainId → Owlracle aliases */
const OWLRACLE_ALIASES: Record<string, string> = {
  ethereum: "eth",
  bsc: "bsc",
};

/**
 * Коэффициент конвертации "стандартной транзакции (21K gas)" → "DEX swap (~150K gas)".
 * Owlracle возвращает estimatedFee для обычной транзакции, для swap'а умножаем.
 */
const SWAP_GAS_MULTIPLIER = 7;

/** Solana — газ статичен на уровне ~5000 lamports за подпись. */
const SOLANA_SWAP_USD = 0.001;

interface OwlracleResponse {
  speeds?: Array<{
    estimatedFee?: number;
  }>;
}

async function fetchChainGasUsd(chain: string): Promise<number | null> {
  const alias = OWLRACLE_ALIASES[chain];
  if (!alias) return null;
  try {
    const res = await fetch(`${OWLRACLE_BASE}/${alias}/gas`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OwlracleResponse;
    const standardFee = data.speeds?.[1]?.estimatedFee;
    if (typeof standardFee !== "number" || !isFinite(standardFee)) return null;
    return standardFee * SWAP_GAS_MULTIPLIER;
  } catch {
    return null;
  }
}

// ============================================================================
// Кэш на 10 минут
// ============================================================================

interface GasCache {
  data: Record<string, number>;
  timestamp: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: GasCache | null = null;

/**
 * Получить актуальные gas-цены по сетям.
 * Возвращает кэшированные данные если они свежие (<10 минут),
 * иначе делает запрос к Owlracle.
 *
 * Возвращает Map<chainId, fee_usd> для chains: ethereum, bsc, solana.
 */
export async function getGasPrices(): Promise<{
  data: Record<string, number>;
  cacheAge: number;
  fromCache: boolean;
}> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return {
      data: cache.data,
      cacheAge: now - cache.timestamp,
      fromCache: true,
    };
  }

  const [eth, bsc] = await Promise.all([
    fetchChainGasUsd("ethereum"),
    fetchChainGasUsd("bsc"),
  ]);

  const result: Record<string, number> = {
    solana: SOLANA_SWAP_USD,
  };
  if (eth !== null) result.ethereum = eth;
  if (bsc !== null) result.bsc = bsc;

  cache = { data: result, timestamp: now };

  return { data: result, cacheAge: 0, fromCache: false };
}

/**
 * Удобный синхронный геттер. Если кэша нет (или для сети нет live данных),
 * возвращает null и вызывающий код должен использовать fallback из GAS_ESTIMATE_USD.
 *
 * Использовать в местах где не хочется awaitить (UI hot path).
 */
export function getCachedGasSync(chain: string): number | null {
  if (!cache) return null;
  const v = cache.data[chain];
  return typeof v === "number" && isFinite(v) ? v : null;
}
