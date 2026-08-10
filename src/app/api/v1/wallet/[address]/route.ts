import { NextRequest, NextResponse } from "next/server";
import { fetchWalletBalances } from "@/services/wallet/data";
import { observeWalletBestEffort } from "@/services/database/persistence";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: NextRequest, context: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await context.params;
    const data = await fetchWalletBalances(address);
    await observeWalletBestEffort(address);
    return NextResponse.json(data, { headers: { "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Unable to fetch wallet." }, { status: 400 });
  }
}
