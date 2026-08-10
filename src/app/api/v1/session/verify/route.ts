import { NextRequest, NextResponse } from "next/server";
import { CHALLENGE_COOKIE, clearChallengeCookie, verifyWalletChallenge, sessionCookie, walletChallengeReplayKey } from "@/services/session/server";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { assertMutationRequest } from "@/services/security/request-security";
import { readJson } from "@/utils/safe-actions";
import { apiErrorResponse } from "@/utils/api-response";
import { getServerConfig } from "@/config/env";
import { AppError } from "@/utils/errors";
import { acquireIdempotency, completeIdempotency, payloadHash, releaseIdempotency } from "@/services/security/idempotency";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const limit = await enforceRateLimit(request, "session-verify", 15);
    const body = await readJson<{ token?: unknown; signature?: unknown; address?: unknown }>(request, 32_000);
    if (typeof body.token !== "string" || body.token.length > 8_000 || typeof body.signature !== "string" || body.signature.length > 4_096) throw new AppError("BAD_REQUEST", "Invalid wallet verification payload.");
    const challengeCookieValue = request.cookies.get(CHALLENGE_COOKIE)?.value;
    if (!challengeCookieValue || challengeCookieValue !== body.token) throw new AppError("UNAUTHORIZED", "Wallet verification challenge is missing or does not match this browser session.");

    // Reserve the challenge before signature verification so two concurrent
    // requests cannot mint independent sessions from the same signed challenge.
    // Database-backed idempotency makes this cross-instance when persistence is
    // enabled; the process-local fallback still protects a single function instance.
    const config = getServerConfig();
    const replayKey = walletChallengeReplayKey(body.token);
    const replayHash = payloadHash({ token: body.token });
    const reservation = await acquireIdempotency(replayKey, replayHash, {
      resultTtlMs: config.sessionChallengeTtlMs,
      lockTtlMs: Math.min(config.sessionChallengeTtlMs, 60_000),
    });
    if (reservation.state !== "acquired") {
      throw new AppError("UNAUTHORIZED", "Wallet verification challenge has already been used or is being verified.");
    }

    try {
      const verified = await verifyWalletChallenge({ token: body.token, signature: body.signature, address: String(body.address ?? "") });
      await completeIdempotency(replayKey, replayHash, 204, { consumed: true }, config.sessionChallengeTtlMs);
      const response = NextResponse.json({ authenticated: true, configured: true, required: config.requireWalletSession, address: verified.session.address, network: verified.session.network, issuedAt: verified.session.issuedAt, expiresAt: verified.session.expiresAt }, { headers: { "cache-control": "no-store", ...rateLimitHeaders(limit) } });
      response.headers.append("set-cookie", sessionCookie(verified.token, Math.floor(config.sessionTtlMs / 1000)));
      response.headers.append("set-cookie", clearChallengeCookie());
      return response;
    } catch (cause) {
      // Invalid signatures and malformed payloads are safe to retry while the
      // short-lived challenge is still valid. Successful verification consumes it.
      await releaseIdempotency(replayKey, replayHash);
      throw cause;
    }
  } catch (cause) { return apiErrorResponse(cause, "Wallet verification failed."); }
}
