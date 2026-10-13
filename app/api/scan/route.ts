import { NextRequest, NextResponse } from "next/server";
import { runScan, getCachedScan } from "@/lib/scanner";
import type { TradeAmount } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 минут на длинный скан

/**
 * GET /api/scan?amount=1000&force=1
 * Возвращает результаты последнего скана.
 * Если кэш старше 30 секунд (или force=1), запускает новый скан.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const amountParam = searchParams.get("amount");
  const force = searchParams.get("force") === "1";

  let amount: TradeAmount = 1000;
  if (amountParam === "100") amount = 100;
  else if (amountParam === "10000") amount = 10000;

  const cached = getCachedScan();
  const cacheAge = Date.now() - cached.lastScan;
  const STALE_MS = 30_000;

  // Если кэш свежий и не форс — отдаём кэш
  if (!force && cached.lastScan > 0 && cacheAge < STALE_MS) {
    return NextResponse.json({
      ok: true,
      results: cached.results,
      lastScan: cached.lastScan,
      cacheAge,
      fromCache: true,
      scanInProgress: cached.scanInProgress,
      scanProgress: cached.scanProgress,
      errors: cached.errors,
    });
  }

  // Если уже сканируем — отдаём текущий кэш с флагом
  if (cached.scanInProgress) {
    return NextResponse.json({
      ok: true,
      results: cached.results,
      lastScan: cached.lastScan,
      cacheAge,
      fromCache: true,
      scanInProgress: true,
      scanProgress: cached.scanProgress,
      errors: cached.errors,
    });
  }

  // Запускаем новый скан
  try {
    const { results, errors } = await runScan(amount);
    return NextResponse.json({
      ok: true,
      results,
      lastScan: Date.now(),
      cacheAge: 0,
      fromCache: false,
      scanInProgress: false,
      scanProgress: { done: results.length, total: results.length },
      errors,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as Error).message,
        results: cached.results,
        lastScan: cached.lastScan,
      },
      { status: 500 }
    );
  }
}
