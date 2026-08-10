import { NextRequest } from "next/server";
import { assertCoinType } from "@/services/sui/address";
import { resolveTrustedToken } from "@/services/tokens/trusted";
import { enforceRateLimit, type RateLimitResult } from "@/services/security/rate-limit";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";
import { readJson } from "@/utils/safe-actions";
import { assertMutationRequest } from "@/services/security/request-security";

export const runtime = "nodejs";
const MAX_COIN_TYPE_LENGTH = 512;
const MAX_BODY_BYTES = 2_048;
type ResolveTokenBody = { coinType?: unknown };

function safeHttpsIcon(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let limit: RateLimitResult | undefined;
  try {
    assertMutationRequest(request);
    limit = await enforceRateLimit(request, "token-resolve", 30);
    const body = await readJson<ResolveTokenBody>(request, MAX_BODY_BYTES);
    const input = typeof body?.coinType === "string" ? body.coinType.trim() : "";
    if (!input || input.length > MAX_COIN_TYPE_LENGTH) return jsonNoStore({ error: "Enter a valid Sui coin type." }, { status: 400 });

    const coinType = assertCoinType(input, "coin type");
    const token = await resolveTrustedToken(coinType);
    if (token.symbol === "UNKNOWN" && token.decimals === 0) return jsonNoStore({ error: "Token metadata was not found." }, { status: 404 });

    return jsonNoStore({
      coinType: token.coinType,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      iconUrl: safeHttpsIcon(token.iconUrl),
      verified: token.verified,
      verificationSource: token.verified ? "trusted-list" : "unverified",
    }, { headers: { "cache-control": "private, max-age=30" } });
  } catch (cause) {
    return apiErrorResponse(cause, "Unable to resolve token metadata.", limit);
  }
}
