import { NextRequest } from "next/server";
import { getServerConfig } from "@/config/env";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";
import { readJson } from "@/utils/safe-actions";
import { requireFiniteNumber, requireInteger } from "@/utils/validation";
import { assertMutationRequest } from "@/services/security/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValidateBody = { slippageBps?: unknown; priceImpactBps?: unknown; expiresAt?: unknown };

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const limit = await enforceRateLimit(request, "swap-validate", 120);
    const body = await readJson<ValidateBody>(request, 8_192);
    const config = getServerConfig();
    const errors: string[] = [];
    try { requireInteger(body.slippageBps, "Slippage", 1, config.maxSlippageBps); } catch (e) { errors.push(e instanceof Error ? e.message : "Invalid slippage."); }
    try { requireFiniteNumber(body.priceImpactBps, "Price impact", 0, config.maxPriceImpactBps); } catch (e) { errors.push(e instanceof Error ? e.message : "Invalid price impact."); }
    const expiresAt = Number(body.expiresAt);
    if (!Number.isFinite(expiresAt) || Date.now() >= expiresAt) errors.push("Quote is expired.");
    return jsonNoStore({ valid: errors.length === 0, errors, limits: { maxSlippageBps: config.maxSlippageBps, maxPriceImpactBps: config.maxPriceImpactBps } }, { status: errors.length ? 422 : 200, headers: rateLimitHeaders(limit) });
  } catch (cause) {
    return apiErrorResponse(cause, "Unable to validate swap settings.");
  }
}
