import { NextResponse } from "next/server";
import { getCurrencies } from "@/lib/gate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const currencies = await getCurrencies();
    const compact = currencies
      .filter((c) => !c.delisted)
      .map((c) => ({
        symbol: c.currency,
        chains: (c.chains ?? []).map((ch) => ({
          name: ch.name,
          contract: ch.contract_address || ch.addr,
          withdrawDisabled: ch.withdraw_disabled,
          depositDisabled: ch.deposit_disabled,
        })),
      }));
    return NextResponse.json({ ok: true, count: compact.length, currencies: compact });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
