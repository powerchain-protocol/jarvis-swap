import { NextRequest } from "next/server";
import { verifyQuoteClaims } from "@/services/quotes/integrity";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";
import { readJson } from "@/utils/safe-actions";
import { AppError } from "@/utils/errors";
import { assertMutationRequest } from "@/services/security/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = { claims?: unknown; signature?: string };

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const limit = await enforceRateLimit(request, "swap-verify", 120);
    const body = await readJson<VerifyBody>(request, 24_576);
    if (!body?.claims) throw new AppError("BAD_REQUEST", "Quote claims are required.");
    const result = verifyQuoteClaims(body.claims, body.signature);
    return jsonNoStore({ ok: true, ...result }, { headers: rateLimitHeaders(limit) });
  } catch (cause) {
    return apiErrorResponse(cause, "Quote verification failed.");
  }
}
