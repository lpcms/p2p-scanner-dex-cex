import type {
  StrategyCalculation,
  StrategyDirection,
  StrategyStep,
} from "@/types/strategy";
import type { ScanResult } from "@/types";
import {
  estimateSwapGasUsd,
  gateChainToDexScreener,
  getFuturesContract,
} from "./gate";
import { getGasPrices } from "./gas";

// ============================================================================
// Параметры стратегии
// ============================================================================

const CEX_SPOT_TAKER_FEE = 0.001;    // 0.1% Gate spot taker
const CEX_FUTURES_TAKER_FEE = 0.0005; // 0.05% Gate futures taker
const DEX_POOL_FEE = 0.003;           // 0.3% средняя по DEX

/** Оценочное время вывода CEX→сеть (минут) */
const CEX_WITHDRAW_TIME_MIN = 15;
/** Оценочное время свапа DEX (минут) */
const DEX_SWAP_TIME_MIN = 3;
/** Оценочное время депозита сеть→CEX (минут) */
const DEX_TO_CEX_DEPOSIT_TIME_MIN = 30;

// ============================================================================
// Главные функции расчёта
// ============================================================================

/**
 * Получить оценку газа для свапа в указанной сети.
 * Сначала пытается взять live-данные с Owlracle (через кэш в lib/gas.ts),
 * если для сети нет live-данных — fallback на статический GAS_ESTIMATE_USD.
 */
async function getLiveGasFee(chain: string): Promise<number> {
  try {
    const { data } = await getGasPrices();
    // Маппим Gate-сеть в Owlracle/DexScreener формат
    const dexId = gateChainToDexScreener(chain);
    if (dexId && typeof data[dexId] === "number" && isFinite(data[dexId])) {
      return data[dexId];
    }
  } catch {
    // ignore — упадём на хардкод
  }
  return estimateSwapGasUsd(chain);
}

/**
 * Рассчитать стратегию CEX → DEX с хеджем (открываем short при покупке спота).
 */
export async function calculateCexToDexStrategy(
  row: ScanResult,
  tradeAmount: number,
  withdrawalFee: number
): Promise<StrategyCalculation> {
  const futures = await getFuturesContract(row.pair);
  const hasFutures = futures !== null;

  const gasFee = await getLiveGasFee(row.chain);

  // === Цены ===
  // Покупаем на CEX по ask, продаём на DEX по эффективной bid (с slippage)
  const cexBuyPrice = row.cexAsk;
  const dexSellPrice = row.dexBid;

  // === Брутто ===
  // Сколько токенов получим за tradeAmount, заплатив taker fee
  const tokensBought = (tradeAmount * (1 - CEX_SPOT_TAKER_FEE)) / cexBuyPrice;
  // Сколько USDT получим, продав на DEX (минус pool fee — уже в dexBid)
  const usdtReceived = tokensBought * dexSellPrice;
  const grossProfit = usdtReceived - tradeAmount;

  // === Комиссии ===
  const cexSpotFee = tradeAmount * CEX_SPOT_TAKER_FEE;
  const dexPoolFee = tradeAmount * DEX_POOL_FEE; // приближённо (на самом деле от swap-volume)

  // === Хедж ===
  const fundingRate = futures?.funding_rate ? parseFloat(futures.funding_rate) : 0;
  const fundingIntervalSec = futures?.funding_interval ?? 28800;
  const fundingIntervalHours = fundingIntervalSec / 3600;

  // Время удержания позиции = время вывода + время свапа
  const holdTimeMin = CEX_WITHDRAW_TIME_MIN + DEX_SWAP_TIME_MIN;
  const holdTimeHours = holdTimeMin / 60;

  // Funding выплачивается каждые fundingIntervalHours.
  // Short платит, если funding > 0; получает, если funding < 0.
  // Доля периода, которую держим позицию:
  const fundingPeriods = holdTimeHours / fundingIntervalHours;
  // Для short: -fundingRate * tradeAmount * fundingPeriods
  // (если ставка положительная — это РАСХОД shorta)
  const fundingCost = -fundingRate * tradeAmount * fundingPeriods;

  // Открыли short + закрыли = 2 taker сделки
  const cexFuturesFee = hasFutures ? tradeAmount * CEX_FUTURES_TAKER_FEE * 2 : 0;

  // === Итого ===
  const totalCosts =
    cexSpotFee + cexFuturesFee + dexPoolFee + withdrawalFee + gasFee;
  const netProfit = grossProfit - totalCosts + fundingCost;
  const netProfitPercent = (netProfit / tradeAmount) * 100;

  // Без хеджа: те же цифры, но без futures fees / funding
  const unhedgedNetProfit =
    grossProfit - (cexSpotFee + dexPoolFee + withdrawalFee + gasFee);

  // === Шаги ===
  const steps: StrategyStep[] = [
    {
      num: 1,
      title: `Купить ${row.symbol} на Gate (Spot)`,
      description: `Покупка ${tokensBought.toFixed(4)} ${row.symbol} за ${tradeAmount.toFixed(2)} USDT по цене ${cexBuyPrice}.`,
      venue: "CEX_SPOT",
      durationMin: 1,
      cost: cexSpotFee,
    },
    ...(hasFutures
      ? [
          {
            num: 2,
            title: `Открыть SHORT на Gate Futures`,
            description: `Открыть short-позицию на ${row.symbol}/USDT перпеч на сумму ${tradeAmount.toFixed(2)} USDT. Хедж сработает, пока вы выводите токен и совершаете swap.`,
            venue: "CEX_FUTURES" as const,
            durationMin: 1,
            cost: tradeAmount * CEX_FUTURES_TAKER_FEE,
          },
        ]
      : [
          {
            num: 2,
            title: `⚠ Хедж недоступен`,
            description: `На Gate Futures нет перпеч-контракта ${row.pair}. Стратегия выполняется без хеджа — цена может измениться за время вывода и swap.`,
            venue: "CEX_FUTURES" as const,
            durationMin: 0,
            warning: "Без хеджа",
          },
        ]),
    {
      num: hasFutures ? 3 : 3,
      title: `Вывести ${row.symbol} в сеть ${row.chain}`,
      description: `Вывод с Gate на свой кошелёк в сети ${row.chain}. Комиссия: ${withdrawalFee.toFixed(4)} USDT.`,
      venue: "NETWORK",
      durationMin: CEX_WITHDRAW_TIME_MIN,
      cost: withdrawalFee,
    },
    {
      num: hasFutures ? 4 : 4,
      title: `Продать ${row.symbol} на ${row.dexId}`,
      description: `Swap ${tokensBought.toFixed(4)} ${row.symbol} → USDT по эффективной цене ${dexSellPrice.toFixed(6)} (с учётом slippage и pool fee).`,
      venue: "DEX",
      durationMin: DEX_SWAP_TIME_MIN,
      cost: gasFee + dexPoolFee,
    },
    ...(hasFutures
      ? [
          {
            num: 5,
            title: `Закрыть SHORT на Gate Futures`,
            description: `Закрытие short-позиции. Хедж компенсирует любое движение цены за время операции.`,
            venue: "CEX_FUTURES" as const,
            durationMin: 1,
            cost: tradeAmount * CEX_FUTURES_TAKER_FEE,
          },
        ]
      : []),
  ];

  return {
    direction: "CEX_TO_DEX",
    feasible: netProfit > 0,
    reason: netProfit > 0 ? undefined : "Чистая прибыль отрицательная после всех комиссий",
    steps,
    tradeAmount,
    cexBid: row.cexBid,
    cexAsk: row.cexAsk,
    dexAsk: row.dexAsk,
    dexBid: row.dexBid,
    cexSpotFee,
    cexFuturesFee,
    dexPoolFee,
    withdrawalFee,
    gasFee,
    fundingRate,
    fundingIntervalHours,
    estimatedHoldTimeHours: holdTimeHours,
    fundingCost,
    grossProfit,
    totalCosts,
    netProfit,
    netProfitPercent,
    unhedgedNetProfit,
    unhedgedRisk: `Без хеджа цена ${row.symbol} может измениться за ~${holdTimeMin} минут вывода. Историческая волатильность 5-10% за час — обычное явление для альткоинов.`,
  };
}

/**
 * Рассчитать стратегию DEX → CEX с хеджем (открываем short ДО покупки на DEX).
 *
 * Логика: на DEX вы НЕ можете «зарезервировать» цену — swap мгновенный.
 * Поэтому хедж открывается ПЕРЕД swap'ом, и закрывается ПОСЛЕ продажи на CEX.
 */
export async function calculateDexToCexStrategy(
  row: ScanResult,
  tradeAmount: number,
  withdrawalFee: number
): Promise<StrategyCalculation> {
  const futures = await getFuturesContract(row.pair);
  const hasFutures = futures !== null;

  const gasFee = await getLiveGasFee(row.chain);

  // === Цены ===
  const dexBuyPrice = row.dexAsk;
  const cexSellPrice = row.cexBid;

  // === Брутто ===
  const tokensBought = tradeAmount / dexBuyPrice;
  const usdtReceived = tokensBought * cexSellPrice * (1 - CEX_SPOT_TAKER_FEE);
  const grossProfit = usdtReceived - tradeAmount;

  // === Комиссии ===
  const cexSpotFee = tradeAmount * CEX_SPOT_TAKER_FEE;
  const dexPoolFee = tradeAmount * DEX_POOL_FEE;

  // === Хедж ===
  // В DEX→CEX короткая позиция открывается ДО покупки на DEX.
  // Логика: купили на DEX → токен в кошельке → отправили на CEX (deposit) → продали → закрыли short.
  // Поэтому хедж висит дольше: gas+swap + deposit confirmation + sell.
  const fundingRate = futures?.funding_rate ? parseFloat(futures.funding_rate) : 0;
  const fundingIntervalSec = futures?.funding_interval ?? 28800;
  const fundingIntervalHours = fundingIntervalSec / 3600;

  const holdTimeMin = DEX_SWAP_TIME_MIN + DEX_TO_CEX_DEPOSIT_TIME_MIN + 1;
  const holdTimeHours = holdTimeMin / 60;

  const fundingPeriods = holdTimeHours / fundingIntervalHours;
  // Для short при положительном funding мы платим. Но в стратегии DEX→CEX
  // позиция дольше — funding cost потенциально больше.
  const fundingCost = -fundingRate * tradeAmount * fundingPeriods;

  const cexFuturesFee = hasFutures ? tradeAmount * CEX_FUTURES_TAKER_FEE * 2 : 0;

  // === Итого ===
  // withdrawalFee здесь = stable fee на депозит токена на CEX. Чаще всего 0 на Gate.
  // Но для некоторых сетей/токенов есть депозитная комиссия — оставляем параметр.
  const totalCosts =
    cexSpotFee + cexFuturesFee + dexPoolFee + withdrawalFee + gasFee;
  const netProfit = grossProfit - totalCosts + fundingCost;
  const netProfitPercent = (netProfit / tradeAmount) * 100;

  const unhedgedNetProfit =
    grossProfit - (cexSpotFee + dexPoolFee + withdrawalFee + gasFee);

  const steps: StrategyStep[] = [
    ...(hasFutures
      ? [
          {
            num: 1,
            title: `Открыть SHORT на Gate Futures`,
            description: `Сначала открываем short на ${row.pair}, чтобы хеджировать риск перед покупкой на DEX.`,
            venue: "CEX_FUTURES" as const,
            durationMin: 1,
            cost: tradeAmount * CEX_FUTURES_TAKER_FEE,
          },
        ]
      : [
          {
            num: 1,
            title: `⚠ Хедж недоступен`,
            description: `На Gate Futures нет перпеч-контракта ${row.pair}. Стратегия идёт без хеджа.`,
            venue: "CEX_FUTURES" as const,
            durationMin: 0,
            warning: "Без хеджа",
          },
        ]),
    {
      num: 2,
      title: `Купить ${row.symbol} на ${row.dexId}`,
      description: `Swap USDT → ${row.symbol} в сети ${row.chain}. Получим ${tokensBought.toFixed(4)} ${row.symbol}.`,
      venue: "DEX",
      durationMin: DEX_SWAP_TIME_MIN,
      cost: gasFee + dexPoolFee,
    },
    {
      num: 3,
      title: `Депозит ${row.symbol} на Gate`,
      description: `Отправить токены в сети ${row.chain} на свой Gate-депозит. Деньги станут доступны для торговли после ~${DEX_TO_CEX_DEPOSIT_TIME_MIN} мин (зависит от сети).`,
      venue: "NETWORK",
      durationMin: DEX_TO_CEX_DEPOSIT_TIME_MIN,
      cost: withdrawalFee,
    },
    {
      num: 4,
      title: `Продать ${row.symbol} на Gate (Spot)`,
      description: `Маркет-ордер на продажу ${tokensBought.toFixed(4)} ${row.symbol} по bid ${cexSellPrice}.`,
      venue: "CEX_SPOT",
      durationMin: 1,
      cost: cexSpotFee,
    },
    ...(hasFutures
      ? [
          {
            num: 5,
            title: `Закрыть SHORT на Gate Futures`,
            description: `Закрытие short-позиции. Хедж компенсировал движение цены за всё время операции.`,
            venue: "CEX_FUTURES" as const,
            durationMin: 1,
            cost: tradeAmount * CEX_FUTURES_TAKER_FEE,
          },
        ]
      : []),
  ];

  return {
    direction: "DEX_TO_CEX",
    feasible: netProfit > 0,
    reason: netProfit > 0 ? undefined : "Чистая прибыль отрицательная после всех комиссий",
    steps,
    tradeAmount,
    cexBid: row.cexBid,
    cexAsk: row.cexAsk,
    dexAsk: row.dexAsk,
    dexBid: row.dexBid,
    cexSpotFee,
    cexFuturesFee,
    dexPoolFee,
    withdrawalFee,
    gasFee,
    fundingRate,
    fundingIntervalHours,
    estimatedHoldTimeHours: holdTimeHours,
    fundingCost,
    grossProfit,
    totalCosts,
    netProfit,
    netProfitPercent,
    unhedgedNetProfit,
    unhedgedRisk: `Без хеджа цена может измениться за ~${holdTimeMin} мин (включая ~${DEX_TO_CEX_DEPOSIT_TIME_MIN} мин депозита). Для DEX→CEX направления риск больше, чем для обратного, потому что депозит дольше вывода.`,
  };
}

/** Универсальная диспетчерная функция */
export async function calculateStrategy(
  row: ScanResult,
  tradeAmount: number,
  withdrawalFee: number,
  direction: StrategyDirection
): Promise<StrategyCalculation> {
  if (direction === "CEX_TO_DEX") {
    return calculateCexToDexStrategy(row, tradeAmount, withdrawalFee);
  }
  return calculateDexToCexStrategy(row, tradeAmount, withdrawalFee);
}
