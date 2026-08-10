import { NextRequest, NextResponse } from "next/server";
import { normalizeSuiAddress } from "@/services/sui/address";
import { fetchLiquidityAccount } from "@/services/pools/accounting";
import { enforceRateLimit } from "@/services/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit(request, "pool-positions", 60);
    const owner = normalizeSuiAddress(request.nextUrl.searchParams.get("owner") ?? "");
    const account = await fetchLiquidityAccount(owner);
    return NextResponse.json({ ok: true, ...account }, { headers: { "cache-control": "private, max-age=0, must-revalidate" } });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : "Unable to fetch Cetus positions." }, { status: 400, headers: { "cache-control": "no-store" } });
  }
}
