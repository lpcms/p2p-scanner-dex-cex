import { NextRequest, NextResponse } from "next/server";
import { calculateStrategy } from "@/lib/strategy";
import { getWithdrawStatus } from "@/lib/gate";
import { getCachedScan } from "@/lib/scanner";
import type { StrategyDirection } from "@/types/strategy";

export const dynamic = "force-dynamic";

/**
 * GET /api/strategy?pair=PEPE_USDT&chain=ETH&amount=1000&direction=CEX_TO_DEX
 *
 * Возвращает расчёт стратегии хеджированного арбитража.
 * Извлекает данные о ценах из кэша последнего скана.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get("pair");
  const chain = searchParams.get("chain");
  const amountRaw = searchParams.get("amount");
  const directionRaw = searchParams.get("direction");

  if (!pair || !chain || !amountRaw || !directionRaw) {
    return NextResponse.json(
      {
        ok: false,
        error: "Required: pair, chain, amount, direction",
      },
      { status: 400 }
    );
  }

  const amount = parseFloat(amountRaw);
  if (!isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid amount" },
      { status: 400 }
    );
  }

  if (directionRaw !== "CEX_TO_DEX" && directionRaw !== "DEX_TO_CEX") {
    return NextResponse.json(
      { ok: false, error: "Invalid direction" },
      { status: 400 }
    );
  }
  const direction = directionRaw as StrategyDirection;

  // Ищем данные о токене в кэше последнего скана
  const cached = getCachedScan();
  const row = cached.results.find(
    (r) => r.pair === pair && r.chain === chain
  );
  if (!row) {
    return NextResponse.json(
      {
        ok: false,
        error: `Token ${pair} on chain ${chain} not found in latest scan`,
      },
      { status: 404 }
    );
  }

  // Получаем withdrawal fee
  let withdrawalFee = 0;
  try {
    const statuses = await getWithdrawStatus();
    const status = statuses.find((s) => s.currency === row.symbol);
    if (status?.withdraw_fix_on_chains) {
      // ключ может быть в верхнем или нижнем регистре
      const chainKey =
        Object.keys(status.withdraw_fix_on_chains).find(
          (k) => k.toUpperCase() === chain.toUpperCase()
        ) ?? chain;
      const fee = parseFloat(status.withdraw_fix_on_chains[chainKey] ?? "0");
      // fee выражена в самой валюте токена — пересчитываем в USDT через cexMid
      withdrawalFee = isFinite(fee) ? fee * row.cexMid : 0;
    } else if (status?.withdraw_fix) {
      const fee = parseFloat(status.withdraw_fix);
      withdrawalFee = isFinite(fee) ? fee * row.cexMid : 0;
    }
  } catch (err) {
    // не критично — продолжаем с 0
    console.error("Failed to fetch withdraw_status:", err);
  }

  try {
    const strategy = await calculateStrategy(
      row,
      amount,
      withdrawalFee,
      direction
    );
    return NextResponse.json({ ok: true, strategy });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
