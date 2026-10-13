// Strategy types — расчёт хеджированного арбитража

export type StrategyDirection = "CEX_TO_DEX" | "DEX_TO_CEX";

export interface StrategyStep {
  /** Номер шага (1, 2, 3...) */
  num: number;
  /** Короткое название действия */
  title: string;
  /** Подробное описание */
  description: string;
  /** Локация: где совершается шаг */
  venue: "CEX_SPOT" | "CEX_FUTURES" | "DEX" | "NETWORK";
  /** Длительность шага в минутах (оценка) */
  durationMin: number;
  /** Изменение баланса USDT после этого шага (может быть отрицательным) */
  pnlDelta?: number;
  /** Комиссия / стоимость шага (для прозрачности) */
  cost?: number;
  /** Краткая заметка / предупреждение */
  warning?: string;
}

export interface StrategyCalculation {
  direction: StrategyDirection;
  /** Можно ли вообще выполнить стратегию (например, нет фьюча — хеджирование невозможно) */
  feasible: boolean;
  /** Если не feasible — почему */
  reason?: string;

  /** Шаги по порядку */
  steps: StrategyStep[];

  /** Сумма сделки в USDT */
  tradeAmount: number;

  // === Цены ===
  cexBid: number;
  cexAsk: number;
  dexAsk: number;
  dexBid: number;

  // === Комиссии (USD) ===
  cexSpotFee: number;       // taker fee Gate spot (0.1%)
  cexFuturesFee: number;    // taker fee Gate futures (~0.05%)
  dexPoolFee: number;       // средняя комиссия пула (0.3%)
  withdrawalFee: number;    // вывод с CEX в сеть
  gasFee: number;           // gas для swap на DEX

  // === Funding rate (хедж) ===
  fundingRate: number;             // current rate (например, 0.0001)
  fundingIntervalHours: number;    // обычно 8
  estimatedHoldTimeHours: number;  // оценка сколько висит позиция
  fundingCost: number;             // сколько заплатим/получим за funding

  // === Итог ===
  grossProfit: number;       // разница (sell - buy) × amount, без комиссий
  totalCosts: number;        // все комиссии и расходы
  netProfit: number;         // grossProfit - totalCosts ± fundingCost
  netProfitPercent: number;  // netProfit / tradeAmount * 100

  // === Без хеджа (для сравнения) ===
  unhedgedNetProfit: number;
  unhedgedRisk: string;      // описание риска
}
