import type {
  GateCurrency,
  GateCurrencyPair,
  GateOrderBook,
  GateTicker,
} from "@/types";

const GATE_API = "https://api.gateio.ws/api/v4";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    // Gate API can be slow under load
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gate API ${res.status}: ${url} :: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/**
 * Получить список всех валют с их сетями и адресами контрактов.
 */
export async function getCurrencies(): Promise<GateCurrency[]> {
  return fetchJson<GateCurrency[]>(`${GATE_API}/spot/currencies`);
}

/**
 * Получить список всех торговых пар.
 */
export async function getCurrencyPairs(): Promise<GateCurrencyPair[]> {
  return fetchJson<GateCurrencyPair[]>(`${GATE_API}/spot/currency_pairs`);
}

/**
 * Получить тикеры (включая объём) для всех или одной пары.
 * Используем для отбора активных USDT-пар по объёму.
 */
export async function getTickers(): Promise<GateTicker[]> {
  return fetchJson<GateTicker[]>(`${GATE_API}/spot/tickers`);
}

/**
 * Получить стакан для конкретной пары.
 * @param currencyPair например "BTC_USDT"
 * @param limit глубина стакана (по умолчанию 5 уровней — нам этого хватит)
 */
export async function getOrderBook(
  currencyPair: string,
  limit = 5
): Promise<GateOrderBook> {
  return fetchJson<GateOrderBook>(
    `${GATE_API}/spot/order_book?currency_pair=${encodeURIComponent(
      currencyPair
    )}&limit=${limit}`
  );
}

/**
 * Получить тикер для одной пары.
 */
export async function getTicker(
  currencyPair: string
): Promise<GateTicker | null> {
  const arr = await fetchJson<GateTicker[]>(
    `${GATE_API}/spot/tickers?currency_pair=${encodeURIComponent(currencyPair)}`
  );
  return arr[0] ?? null;
}

/**
 * Берём лучшие bid/ask из стакана.
 * Если стакан пуст или поломан — возвращаем null.
 */
export function bestPriceFromOrderBook(
  ob: GateOrderBook
): { bid: number; ask: number } | null {
  const bid = ob.bids?.[0]?.[0];
  const ask = ob.asks?.[0]?.[0];
  if (!bid || !ask) return null;
  const b = parseFloat(bid);
  const a = parseFloat(ask);
  if (!isFinite(b) || !isFinite(a) || b <= 0 || a <= 0) return null;
  return { bid: b, ask: a };
}

/**
 * Какие сети считаются EVM-совместимыми (поддерживаются DexScreener).
 * Маппинг имени сети Gate -> chainId DexScreener.
 */
export const GATE_TO_DEXSCREENER_CHAIN: Record<string, string> = {
  ETH: "ethereum",
  BSC: "bsc",
  ARBEVM: "arbitrum",
  ARBITRUM: "arbitrum",
  POLYGON: "polygon",
  MATIC: "polygon",
  OPETH: "optimism",
  OPTIMISM: "optimism",
  BASEEVM: "base",
  BASE: "base",
  AVAX_C: "avalanche",
  AVAXC: "avalanche",
  AVAX: "avalanche",
  FTM: "fantom",
  FANTOM: "fantom",
  CRO: "cronos",
  GNOSIS: "gnosis",
  XDAI: "gnosis",
  LINEA: "linea",
  SCROLL: "scroll",
  ZKSYNC: "zksync",
  ZKSYNCERA: "zksync",
  MANTLE: "mantle",
  BLAST: "blast",
  CELO: "celo",
  MOONBEAM: "moonbeam",
  MOONRIVER: "moonriver",
  HARMONY: "harmony",
  AURORA: "aurora",
  KAVA: "kava",
  METIS: "metis",
  PULSE: "pulsechain",
  PULSECHAIN: "pulsechain",
  SOL: "solana",
  SOLANA: "solana",
  TRX: "tron",
  TRON: "tron",
  TON: "ton",
  SUI: "sui",
  APT: "aptos",
  APTOS: "aptos",
  SEI: "sei",
  NEAR: "near",
  ALGO: "algorand",
  ICP: "icp",
  STARKNET: "starknet",
  BERA: "berachain",
  BERACHAIN: "berachain",
};

export function gateChainToDexScreener(chain: string): string | null {
  const upper = chain.toUpperCase().replace(/-/g, "_");
  return GATE_TO_DEXSCREENER_CHAIN[upper] ?? null;
}

/**
 * Шаблоны ссылок на blockchain-сканеры по chainId DexScreener.
 * Используем `{addr}` как плейсхолдер для адреса контракта.
 */
const EXPLORER_TEMPLATES: Record<string, string> = {
  ethereum: "https://etherscan.io/token/{addr}",
  bsc: "https://bscscan.com/token/{addr}",
  arbitrum: "https://arbiscan.io/token/{addr}",
  polygon: "https://polygonscan.com/token/{addr}",
  optimism: "https://optimistic.etherscan.io/token/{addr}",
  base: "https://basescan.org/token/{addr}",
  avalanche: "https://snowtrace.io/token/{addr}",
  fantom: "https://ftmscan.com/token/{addr}",
  cronos: "https://cronoscan.com/token/{addr}",
  gnosis: "https://gnosisscan.io/token/{addr}",
  linea: "https://lineascan.build/token/{addr}",
  scroll: "https://scrollscan.com/token/{addr}",
  zksync: "https://explorer.zksync.io/address/{addr}",
  mantle: "https://mantlescan.xyz/token/{addr}",
  blast: "https://blastscan.io/token/{addr}",
  celo: "https://celoscan.io/token/{addr}",
  moonbeam: "https://moonbeam.moonscan.io/token/{addr}",
  moonriver: "https://moonriver.moonscan.io/token/{addr}",
  harmony: "https://explorer.harmony.one/address/{addr}",
  aurora: "https://aurorascan.dev/token/{addr}",
  kava: "https://kavascan.com/token/{addr}",
  metis: "https://andromeda-explorer.metis.io/token/{addr}",
  pulsechain: "https://scan.pulsechain.com/token/{addr}",
  solana: "https://solscan.io/token/{addr}",
  tron: "https://tronscan.org/#/token20/{addr}",
  ton: "https://tonscan.org/jetton/{addr}",
  sui: "https://suiscan.xyz/mainnet/coin/{addr}",
  aptos: "https://aptoscan.com/coin/{addr}",
  sei: "https://seitrace.com/token/{addr}",
  near: "https://nearblocks.io/token/{addr}",
  algorand: "https://allo.info/asset/{addr}",
  icp: "https://dashboard.internetcomputer.org/canister/{addr}",
  starknet: "https://starkscan.co/token/{addr}",
  berachain: "https://beratrail.io/token/{addr}",
};

/**
 * Получить URL на blockchain explorer для адреса контракта.
 * Возвращает null, если для этой сети нет шаблона.
 */
export function getExplorerUrl(chain: string, address: string): string | null {
  const dexId = gateChainToDexScreener(chain);
  if (!dexId || !address) return null;
  const tpl = EXPLORER_TEMPLATES[dexId];
  if (!tpl) return null;
  return tpl.replace("{addr}", address);
}

// ============================================================================
// Withdrawal fees (статика из Gate.io)
// ============================================================================

/**
 * Получить список withdrawal fees по сетям для конкретной валюты на Gate.
 * Возвращает Map<chainName, fee_amount_string>.
 *
 * Endpoint: GET /wallet/withdraw_status?currency={ccy} требует auth.
 * Публичная альтернатива: /spot/currencies — в поле каждой валюты
 * НЕ возвращается withdraw_fix_on_chains публично.
 *
 * Поэтому используем endpoint /wallet/withdraw_status, но без auth он отдаёт
 * урезанные данные. Для MVP кэшируем то что возвращается публично.
 */
export interface GateWithdrawStatus {
  currency: string;
  name?: string;
  name_cn?: string;
  deposit?: string;
  withdraw_percent?: string;
  withdraw_fix?: string;
  withdraw_day_limit?: string;
  withdraw_amount_mini?: string;
  withdraw_fix_on_chains?: Record<string, string>; // chain -> fee
}

/**
 * Получить статусы вывода со всех валют — массив с фиксированными комиссиями
 * вывода по сетям. Публичный endpoint (без auth).
 */
export async function getWithdrawStatus(): Promise<GateWithdrawStatus[]> {
  return fetchJson<GateWithdrawStatus[]>(`${GATE_API}/wallet/withdraw_status`);
}

// ============================================================================
// Gas estimates (хардкод средних значений на 2024-2025)
// ============================================================================

/**
 * Усреднённые стоимости свапа (в USD) по сетям, исходя из текущих gas-price
 * и типичной сложности транзакции swap на Uniswap/PancakeSwap/etc.
 *
 * Это **очень грубая** оценка для индикативного расчёта. В реальном UI
 * лучше дёргать gas API (Etherscan v2, Alchemy etc.), но для MVP хватит.
 *
 * Значения обновлены на 2024-Q4. Можно периодически вручную освежать.
 */
export const GAS_ESTIMATE_USD: Record<string, number> = {
  ethereum: 8.0,    // ~$5–15 в среднем
  bsc: 0.3,
  arbitrum: 0.2,
  optimism: 0.15,
  polygon: 0.05,
  base: 0.1,
  avalanche: 0.15,
  fantom: 0.05,
  cronos: 0.1,
  gnosis: 0.05,
  linea: 0.15,
  scroll: 0.2,
  zksync: 0.25,
  mantle: 0.1,
  blast: 0.15,
  celo: 0.05,
  moonbeam: 0.1,
  moonriver: 0.05,
  harmony: 0.05,
  aurora: 0.05,
  kava: 0.05,
  metis: 0.1,
  pulsechain: 0.05,
  solana: 0.001,
  tron: 5.0,        // TRC20 — высокая комиссия energy/bandwidth
  ton: 0.05,
  sui: 0.01,
  aptos: 0.01,
  sei: 0.01,
  near: 0.01,
  algorand: 0.01,
  starknet: 0.5,
  berachain: 0.2,
};

/**
 * Получить оценку газа для свапа в указанной сети (USD).
 * Если сеть неизвестна — возвращаем $1 как безопасную "среднюю".
 */
export function estimateSwapGasUsd(chain: string): number {
  const dexId = gateChainToDexScreener(chain);
  if (!dexId) return 1.0;
  return GAS_ESTIMATE_USD[dexId] ?? 1.0;
}

// ============================================================================
// Gate Futures API (USDT-settled perpetuals)
// ============================================================================

export interface GateFuturesContract {
  name: string;              // "BTC_USDT"
  type: string;              // "direct" | "inverse"
  funding_rate?: string;     // текущий funding rate (например, "0.0001" = 0.01%)
  funding_interval?: number; // секунд между funding (обычно 28800 = 8h)
  index_price?: string;
  mark_price?: string;
  last_price?: string;
  maker_fee_rate?: string;
  taker_fee_rate?: string;
  trade_size?: number;
  ref_discount_rate?: string;
  ref_rebate_rate?: string;
}

/**
 * Получить контракт USDT-перпеча для конкретной торговой пары.
 * Возвращает null если фьюча на эту пару нет.
 *
 * @param pair например "PEPE_USDT"
 */
export async function getFuturesContract(
  pair: string
): Promise<GateFuturesContract | null> {
  try {
    return await fetchJson<GateFuturesContract>(
      `${GATE_API}/futures/usdt/contracts/${encodeURIComponent(pair)}`
    );
  } catch {
    return null;
  }
}
