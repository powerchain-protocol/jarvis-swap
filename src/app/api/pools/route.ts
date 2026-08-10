import { NextResponse } from "next/server";
import { fetchConfiguredPools } from "@/services/pools/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await fetchConfiguredPools();
    return NextResponse.json(result, { headers: { "cache-control": "public, max-age=5, stale-while-revalidate=10" } });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Cetus pool lookup failed." }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}
