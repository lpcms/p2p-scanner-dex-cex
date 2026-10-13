// === Gate.io API types ===

export interface GateCurrency {
  currency: string;
  delisted: boolean;
  withdraw_disabled: boolean;
  withdraw_delayed: boolean;
  deposit_disabled: boolean;
  trade_disabled: boolean;
  fixed_rate?: string;
  chain?: string;
  chains?: GateCurrencyChain[];
}

export interface GateCurrencyChain {
  name: string;
  addr: string;
  withdraw_disabled: boolean;
  deposit_disabled: boolean;
  decimal?: string;
  contract_address?: string;
}

export interface GateCurrencyPair {
  id: string;
  base: string;
  quote: string;
  fee: string;
  trade_status: string;
  min_base_amount?: string;
  min_quote_amount?: string;
}

export interface GateOrderBook {
  current: number;
  update: number;
  asks: [string, string][]; // [price, amount]
  bids: [string, string][];
}

export interface GateTicker {
  currency_pair: string;
  last: string;
  highest_bid: string;
  lowest_ask: string;
  base_volume: string;
  quote_volume: string;
  change_percentage: string;
}

// === DexScreener API types ===

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative?: string;
  priceUsd?: string;
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  volume?: {
    h24?: number;
    h6?: number;
    h1?: number;
  };
  fdv?: number;
  marketCap?: number;
}

export interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexScreenerPair[] | null;
}

// === Scanner internal types ===

export interface TokenInfo {
  symbol: string;
  pair: string; // e.g. "PEPE_USDT"
  chain: string; // e.g. "ETH", "BSC"
  contractAddress: string;
  cexBid: number; // best bid price on Gate (price you sell at)
  cexAsk: number; // best ask price on Gate (price you buy at)
  cexVolume24h: number; // in USDT
}

export interface ScanResult {
  symbol: string;
  pair: string;
  chain: string;
  contractAddress: string;

  // CEX data
  cexBid: number;
  cexAsk: number;
  /** Mid price = (bid + ask) / 2 — для отображения в колонке "CEX Price" */
  cexMid: number;
  cexVolume24h: number;

  // DEX data
  /** Spot price из пула (без учёта проскальзывания и комиссий) */
  dexPrice: number;
  /** Эффективная цена покупки на DEX = price × (1 + slippage + fee) */
  dexAsk: number;
  /** Эффективная цена продажи на DEX = price × (1 - slippage - fee) */
  dexBid: number;
  dexLiquidityUsd: number;
  dexVolume24h: number;
  dexUrl: string;
  dexId: string;
  /** chainId DexScreener (ethereum, bsc, ...) — для построения прямых ссылок на DEX */
  dexChainId: string;
  /** Адрес пула — для шаблонов биржи, где нужен pair */
  dexPairAddress: string;

  // Direction 1: BUY DEX → SELL CEX
  // We pay dex price (ask-equivalent), we receive cex bid
  spreadDexToCex: number; // %
  profitDexToCex: number; // USDT for given amount

  // Direction 2: BUY CEX → SELL DEX
  // We pay cex ask, we receive dex price (bid-equivalent)
  spreadCexToDex: number; // %
  profitCexToDex: number; // USDT for given amount

  // Best of two
  bestDirection: "DEX_TO_CEX" | "CEX_TO_DEX" | "NONE";
  bestSpread: number;
  bestProfit: number;

  updatedAt: number;
}

export type TradeAmount = 100 | 1000 | 10000;

export interface ScanProgress {
  total: number;
  done: number;
  inProgress: boolean;
  lastUpdate: number;
  errors: string[];
}
