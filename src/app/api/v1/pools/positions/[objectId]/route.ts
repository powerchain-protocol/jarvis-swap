import { NextRequest } from "next/server";
import { normalizeSuiAddress } from "@/services/sui/address";
import { fetchLiquidityAccount } from "@/services/pools/accounting";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ objectId: string }> }) {
  try {
    const limit = await enforceRateLimit(request, "pool-position", 60);
    const owner = normalizeSuiAddress(request.nextUrl.searchParams.get("owner") ?? "");
    const { objectId } = await params;
    const positionId = normalizeSuiAddress(objectId);
    const account = await fetchLiquidityAccount(owner);
    const position = account.positions.find((item) => normalizeSuiAddress(item.objectId) === positionId);
    if (!position) return jsonNoStore({ ok: false, error: { code: "NOT_FOUND", message: "Position was not found in the connected owner's configured Cetus positions." } }, { status: 404, headers: rateLimitHeaders(limit) });
    return jsonNoStore({ ok: true, owner, network: account.network, position }, { headers: rateLimitHeaders(limit) });
  } catch (cause: unknown) {
    return apiErrorResponse(cause, "Unable to fetch position.");
  }
}
