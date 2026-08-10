import { NextRequest } from "next/server";
import { validateLiquidityAction } from "@/services/pools/actions";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";
import { readJson } from "@/utils/safe-actions";
import { assertMutationRequest } from "@/services/security/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const limit = await enforceRateLimit(request, "pool-action-validate", 30);
    const body = await readJson<unknown>(request, 16_384);
    const intent = validateLiquidityAction(body);
    return jsonNoStore({ ok: true, intent, executable: false, message: "Intent validated. Transaction construction remains fail-closed until the audited Cetus SDK execution adapter is enabled." }, { headers: rateLimitHeaders(limit) });
  } catch (cause) {
    return apiErrorResponse(cause, "Invalid liquidity action.");
  }
}
