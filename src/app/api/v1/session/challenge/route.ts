import { NextRequest } from "next/server";
import { challengeCookie, createWalletChallenge } from "@/services/session/server";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { assertMutationRequest } from "@/services/security/request-security";
import { readJson } from "@/utils/safe-actions";
import { apiErrorResponse } from "@/utils/api-response";
import { NextResponse } from "next/server";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const limit = await enforceRateLimit(request, "session-challenge", 20);
    const body = await readJson<{ address?: unknown }>(request, 4_096);
    const challenge = createWalletChallenge(String(body.address ?? ""));
    const response = NextResponse.json(challenge, { headers: { "cache-control": "no-store", ...rateLimitHeaders(limit) } });
    response.headers.append("set-cookie", challengeCookie(challenge.token, Math.max(30, Math.ceil((challenge.expiresAt - Date.now()) / 1000))));
    return response;
  } catch (cause) { return apiErrorResponse(cause, "Unable to create wallet challenge."); }
}
