import { NextResponse } from "next/server";
import { getGasPrices } from "@/lib/gas";

export const dynamic = "force-dynamic";

/**
 * GET /api/gas
 *
 * Возвращает оценку газа за DEX swap в USD по сетям.
 * Поддерживаются: ethereum, bsc, solana.
 * Кэш на 10 минут.
 */
export async function GET() {
  try {
    const { data, cacheAge, fromCache } = await getGasPrices();
    return NextResponse.json({
      ok: true,
      gas: data,
      cacheAge,
      fromCache,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
