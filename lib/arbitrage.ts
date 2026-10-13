import type { ScanResult, TokenInfo, TradeAmount } from "@/types";
import type { DexScreenerPair } from "@/types";

/**
 * Стандартная комиссия Gate.io spot taker (0.1%).
 */
export const CEX_TAKER_FEE = 0.001;

/**
 * Грубая оценка комиссии DEX-пула (среднее между 0.05% и 1%, чаще 0.3%).
 */
export const DEX_DEFAULT_FEE = 0.003;

/**
 * Оценка проскальзывания на DEX по формуле constant-product Uniswap v2:
 * в пуле с TVL = liquidityUsd резервы каждой стороны примерно TVL/2.
 * Для покупки за amount_in (в USD) slip = amount_in / reserve_quote.
 *
 * Для пулов v3 (концентрированная ликвидность) реальное проскальзывание
 * обычно ниже, но без знания feeTier эта оценка даёт безопасную верхнюю
 * границу — реальный профит, как правило, лучше.
 */
export function estimateDexSlippage(
  liquidityUsd: number,
  tradeAmountUsd: number
): number {
  if (liquidityUsd <= 0) return 1;
  const reserveQuote = liquidityUsd / 2;
  const slip = tradeAmountUsd / reserveQuote;
  return Math.min(slip, 1);
}

/**
 * Главная функция: посчитать арбитражные возможности по токену
 * для заданной суммы сделки.
 */
export function calculateArbitrage(
  token: TokenInfo,
  dexPair: DexScreenerPair,
  tradeAmount: TradeAmount
): ScanResult {
  const dexPrice = parseFloat(dexPair.priceUsd ?? "0");
  const dexLiquidityUsd = dexPair.liquidity?.usd ?? 0;
  const dexVolume24h = dexPair.volume?.h24 ?? 0;

  const slippage = estimateDexSlippage(dexLiquidityUsd, tradeAmount);

  // === Direction 1: BUY DEX -> SELL CEX ===
  const dexEffectiveAsk = dexPrice * (1 + slippage) * (1 + DEX_DEFAULT_FEE);
  const cexEffectiveBid = token.cexBid * (1 - CEX_TAKER_FEE);

  const tokensBought_dex = tradeAmount / dexEffectiveAsk;
  const usdtReceived_dexToCex = tokensBought_dex * cexEffectiveBid;
  const profitDexToCex = usdtReceived_dexToCex - tradeAmount;
  const spreadDexToCex =
    dexEffectiveAsk > 0
      ? ((cexEffectiveBid - dexEffectiveAsk) / dexEffectiveAsk) * 100
      : 0;

  // === Direction 2: BUY CEX -> SELL DEX ===
  const cexEffectiveAsk = token.cexAsk * (1 + CEX_TAKER_FEE);
  const dexEffectiveBid = dexPrice * (1 - slippage) * (1 - DEX_DEFAULT_FEE);

  const tokensBought_cex = tradeAmount / cexEffectiveAsk;
  const usdtReceived_cexToDex = tokensBought_cex * dexEffectiveBid;
  const profitCexToDex = usdtReceived_cexToDex - tradeAmount;
  const spreadCexToDex =
    cexEffectiveAsk > 0
      ? ((dexEffectiveBid - cexEffectiveAsk) / cexEffectiveAsk) * 100
      : 0;

  // === Лучшее направление ===
  let bestDirection: ScanResult["bestDirection"] = "NONE";
  let bestSpread = 0;
  let bestProfit = 0;

  if (profitDexToCex > 0 || profitCexToDex > 0) {
    if (profitDexToCex >= profitCexToDex) {
      bestDirection = "DEX_TO_CEX";
      bestSpread = spreadDexToCex;
      bestProfit = profitDexToCex;
    } else {
      bestDirection = "CEX_TO_DEX";
      bestSpread = spreadCexToDex;
      bestProfit = profitCexToDex;
    }
  }
  // Если оба направления убыточные — bestDirection = NONE, bestSpread = 0, bestProfit = 0.

  return {
    symbol: token.symbol,
    pair: token.pair,
    chain: token.chain,
    contractAddress: token.contractAddress,

    cexBid: token.cexBid,
    cexAsk: token.cexAsk,
    cexMid: (token.cexBid + token.cexAsk) / 2,
    cexVolume24h: token.cexVolume24h,

    dexPrice,
    dexAsk: dexEffectiveAsk,
    dexBid: dexEffectiveBid,
    dexLiquidityUsd,
    dexVolume24h,
    dexUrl: dexPair.url,
    dexId: dexPair.dexId,
    dexChainId: dexPair.chainId,
    dexPairAddress: dexPair.pairAddress,

    spreadDexToCex,
    profitDexToCex,
    spreadCexToDex,
    profitCexToDex,

    bestDirection,
    bestSpread,
    bestProfit,

    updatedAt: Date.now(),
  };
}

/**
 * Пересчитать spreads/profits/dexBid/dexAsk для уже посчитанного ScanResult
 * под другую сумму сделки. Используется на клиенте при переключении
 * Trade Amount, чтобы не дёргать сервер заново.
 */
export function recalcForAmount(
  r: ScanResult,
  tradeAmount: TradeAmount
): ScanResult {
  const slippage = estimateDexSlippage(r.dexLiquidityUsd, tradeAmount);

  // === Direction 1: BUY DEX -> SELL CEX ===
  const dexEffectiveAsk = r.dexPrice * (1 + slippage) * (1 + DEX_DEFAULT_FEE);
  const cexEffectiveBid = r.cexBid * (1 - CEX_TAKER_FEE);

  const tokensBought_dex = tradeAmount / dexEffectiveAsk;
  const usdtReceived_dexToCex = tokensBought_dex * cexEffectiveBid;
  const profitDexToCex = usdtReceived_dexToCex - tradeAmount;
  const spreadDexToCex =
    dexEffectiveAsk > 0
      ? ((cexEffectiveBid - dexEffectiveAsk) / dexEffectiveAsk) * 100
      : 0;

  // === Direction 2: BUY CEX -> SELL DEX ===
  const cexEffectiveAsk = r.cexAsk * (1 + CEX_TAKER_FEE);
  const dexEffectiveBid = r.dexPrice * (1 - slippage) * (1 - DEX_DEFAULT_FEE);

  const tokensBought_cex = tradeAmount / cexEffectiveAsk;
  const usdtReceived_cexToDex = tokensBought_cex * dexEffectiveBid;
  const profitCexToDex = usdtReceived_cexToDex - tradeAmount;
  const spreadCexToDex =
    cexEffectiveAsk > 0
      ? ((dexEffectiveBid - cexEffectiveAsk) / cexEffectiveAsk) * 100
      : 0;

  let bestDirection: ScanResult["bestDirection"] = "NONE";
  let bestSpread = 0;
  let bestProfit = 0;

  if (profitDexToCex > 0 || profitCexToDex > 0) {
    if (profitDexToCex >= profitCexToDex) {
      bestDirection = "DEX_TO_CEX";
      bestSpread = spreadDexToCex;
      bestProfit = profitDexToCex;
    } else {
      bestDirection = "CEX_TO_DEX";
      bestSpread = spreadCexToDex;
      bestProfit = profitCexToDex;
    }
  }
  // Если оба направления убыточные — bestDirection = NONE, bestSpread = 0, bestProfit = 0.

  return {
    ...r,
    dexAsk: dexEffectiveAsk,
    dexBid: dexEffectiveBid,
    spreadDexToCex,
    profitDexToCex,
    spreadCexToDex,
    profitCexToDex,
    bestDirection,
    bestSpread,
    bestProfit,
  };
}
