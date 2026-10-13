import type { DexScreenerPair, DexScreenerResponse } from "@/types";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex";

/**
 * DexScreener позволяет батчить до 30 адресов за один запрос.
 * Лимит ~300 запросов/мин на эндпоинт tokens.
 */
const BATCH_SIZE = 30;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`DexScreener ${res.status}: ${url}`);
  }
  return (await res.json()) as T;
}

/**
 * Получить пары для списка адресов токенов.
 * Возвращает массив пар (один токен может быть в нескольких пулах).
 *
 * @param addresses массив адресов контрактов (до 30)
 */
export async function getPairsByTokenAddresses(
  addresses: string[]
): Promise<DexScreenerPair[]> {
  if (addresses.length === 0) return [];
  if (addresses.length > BATCH_SIZE) {
    throw new Error(`Max ${BATCH_SIZE} addresses per request`);
  }
  const url = `${DEXSCREENER_API}/tokens/${addresses.join(",")}`;
  const data = await fetchJson<DexScreenerResponse>(url);
  return data.pairs ?? [];
}

/**
 * Батч-получение для большого количества адресов.
 * Возвращает Map: адрес (lowercase) -> массив пар.
 */
export async function getPairsBatched(
  addresses: string[],
  options: {
    onProgress?: (done: number, total: number) => void;
    delayMs?: number;
  } = {}
): Promise<Map<string, DexScreenerPair[]>> {
  const result = new Map<string, DexScreenerPair[]>();
  const { onProgress, delayMs = 250 } = options;

  // Уникализируем адреса (lowercase)
  const unique = Array.from(
    new Set(addresses.map((a) => a.toLowerCase()))
  ).filter((a) => a && a.length > 0);

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    try {
      const pairs = await getPairsByTokenAddresses(batch);
      for (const pair of pairs) {
        const baseAddr = pair.baseToken.address.toLowerCase();
        if (!result.has(baseAddr)) result.set(baseAddr, []);
        result.get(baseAddr)!.push(pair);
      }
    } catch (err) {
      console.error(`Batch ${i / BATCH_SIZE} failed:`, err);
      // Продолжаем — частичный результат лучше, чем ничего
    }
    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, unique.length), unique.length);
    }
    if (i + BATCH_SIZE < unique.length && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return result;
}

/**
 * Выбрать «лучший» пул из списка для данного токена на данной сети.
 * Критерий — максимальная USD-ликвидность среди пулов с quote = USDT/USDC/WETH/WBNB и т.п.
 */
export function pickBestPool(
  pairs: DexScreenerPair[],
  chainId: string
): DexScreenerPair | null {
  const onChain = pairs.filter((p) => p.chainId === chainId);
  if (onChain.length === 0) return null;

  // Предпочитаем пулы со стейблами/основными парами
  const preferredQuotes = new Set([
    "USDT",
    "USDC",
    "DAI",
    "BUSD",
    "WETH",
    "ETH",
    "WBNB",
    "BNB",
    "USDC.E",
  ]);

  const scored = onChain
    .map((p) => {
      const liq = p.liquidity?.usd ?? 0;
      const quote = p.quoteToken.symbol.toUpperCase();
      const preferred = preferredQuotes.has(quote) ? 1 : 0;
      // лимит дабы не делилось на пулы $5
      if (liq < 1000) return null;
      return { pair: p, score: liq * (preferred ? 1 : 0.3) };
    })
    .filter((x): x is { pair: DexScreenerPair; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.pair ?? null;
}

/**
 * Прямые ссылки на swap-страницы популярных DEX.
 * Если для пары dexId+chain нет шаблона — возвращаем null (UI fallback'нется на DexScreener URL).
 *
 * Плейсхолдеры:
 *   {token}     — адрес целевого токена
 *   {pairAddr}  — адрес пула (если применимо)
 *   {chain}     — chainId DexScreener
 */
const DEX_SWAP_TEMPLATES: Array<{
  match: (dexId: string, chain: string) => boolean;
  build: (token: string, pairAddr: string, chain: string) => string;
}> = [
  // === Ethereum / Arbitrum / Optimism / Polygon / Base ===
  {
    match: (id) => id === "uniswap" || id.startsWith("uniswap"),
    build: (token, _pair, chain) => {
      const chainSlug =
        {
          ethereum: "mainnet",
          arbitrum: "arbitrum",
          optimism: "optimism",
          polygon: "polygon",
          base: "base",
          bsc: "bnb",
          avalanche: "avalanche",
          celo: "celo",
          blast: "blast",
          zora: "zora",
        }[chain] ?? "mainnet";
      return `https://app.uniswap.org/swap?outputCurrency=${token}&chain=${chainSlug}`;
    },
  },

  // === BSC ===
  {
    match: (id, chain) => chain === "bsc" && id.startsWith("pancakeswap"),
    build: (token) => `https://pancakeswap.finance/swap?outputCurrency=${token}`,
  },

  // === SushiSwap (multi-chain) ===
  {
    match: (id) => id === "sushiswap" || id.startsWith("sushi"),
    build: (token, _pair, chain) => {
      const chainId =
        { ethereum: "1", arbitrum: "42161", polygon: "137", optimism: "10", bsc: "56", avalanche: "43114", base: "8453" }[
          chain
        ] ?? "1";
      return `https://www.sushi.com/swap?chainId=${chainId}&token1=${token}`;
    },
  },

  // === Polygon: QuickSwap ===
  {
    match: (id, chain) => chain === "polygon" && id.startsWith("quickswap"),
    build: (token) => `https://quickswap.exchange/#/swap?outputCurrency=${token}`,
  },

  // === Arbitrum: Camelot ===
  {
    match: (id, chain) => chain === "arbitrum" && id.startsWith("camelot"),
    build: (token) => `https://app.camelot.exchange/?token2=${token}`,
  },

  // === Avalanche: Trader Joe ===
  {
    match: (id, chain) => chain === "avalanche" && (id === "traderjoe" || id.startsWith("joe")),
    build: (token) => `https://traderjoexyz.com/avalanche/trade?outputCurrency=${token}`,
  },

  // === Base: Aerodrome ===
  {
    match: (id, chain) => chain === "base" && id.startsWith("aerodrome"),
    build: (token) => `https://aerodrome.finance/swap?to=${token}`,
  },

  // === Optimism: Velodrome ===
  {
    match: (id, chain) => chain === "optimism" && id.startsWith("velodrome"),
    build: (token) => `https://velodrome.finance/swap?to=${token}`,
  },

  // === Solana: Raydium / Orca / Jupiter (Jup. — универсальный агрегатор)
  {
    match: (id, chain) => chain === "solana" && id.startsWith("raydium"),
    build: (token) =>
      `https://raydium.io/swap/?inputMint=sol&outputMint=${token}`,
  },
  {
    match: (id, chain) => chain === "solana" && id.startsWith("orca"),
    build: (token) => `https://www.orca.so/?tokenOut=${token}`,
  },
  {
    match: (_id, chain) => chain === "solana", // fallback для Solana → Jupiter
    build: (token) =>
      `https://jup.ag/swap/SOL-${token}`,
  },

  // === Cronos: VVS Finance ===
  {
    match: (id, chain) => chain === "cronos" && id.startsWith("vvs"),
    build: (token) => `https://vvs.finance/swap?outputCurrency=${token}`,
  },

  // === Fantom: SpookySwap ===
  {
    match: (id, chain) => chain === "fantom" && id.startsWith("spooky"),
    build: (token) => `https://spooky.fi/#/swap?outputCurrency=${token}`,
  },
];

/**
 * Построить прямую ссылку на DEX-биржу для конкретного токена.
 * @returns URL или null, если шаблон не найден.
 */
export function getDexSwapUrl(
  dexId: string,
  chainId: string,
  tokenAddress: string,
  pairAddress: string
): string | null {
  const id = dexId.toLowerCase();
  const chain = chainId.toLowerCase();
  for (const tpl of DEX_SWAP_TEMPLATES) {
    if (tpl.match(id, chain)) {
      try {
        return tpl.build(tokenAddress, pairAddress, chain);
      } catch {
        return null;
      }
    }
  }
  return null;
}
