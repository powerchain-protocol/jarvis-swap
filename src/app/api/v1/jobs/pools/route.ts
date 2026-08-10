import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/services/security/cron";
import { fetchConfiguredPools } from "@/services/pools/registry";
import { databasePersistenceEnabled } from "@/services/database/persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    assertCronAuthorized(request);
    const result = await fetchConfiguredPools();
    if (!databasePersistenceEnabled()) return NextResponse.json({ ok: true, configured: result.configured, persisted: false, pools: result.pools.length });
    const { persistPoolRegistry } = await import("@db/prisma/repositories/liquidity");
    const snapshots = await persistPoolRegistry(result.network, result.pools);
    return NextResponse.json({ ok: true, configured: result.configured, persisted: true, pools: result.pools.length, snapshots });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Pool snapshot failed.";
    return NextResponse.json({ ok: false, error: message }, { status: message.toLowerCase().includes("unauthorized") ? 401 : 500, headers: { "cache-control": "no-store" } });
  }
}
