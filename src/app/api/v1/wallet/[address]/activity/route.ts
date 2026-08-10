import { NextRequest } from "next/server";
import { normalizeSuiAddress } from "@/services/sui/address";
import { listTransactionsBySenderGrpc } from "@/services/sui/grpc";
import { getServerConfig } from "@/config/env";
import { enforceRateLimit, rateLimitHeaders, type RateLimitResult } from "@/services/security/rate-limit";
import { AppError } from "@/utils/errors";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";
import { requireInteger } from "@/utils/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function optionalCursor(value: string | null, name: string) {
  if (value == null || value === "") return undefined;
  if (value.length > 256 || !/^[A-Za-z0-9_:+/=.\-]+$/.test(value)) {
    throw new AppError("BAD_REQUEST", `${name} cursor is invalid.`);
  }
  return value;
}

export async function GET(request: NextRequest, context: { params: Promise<{ address: string }> }) {
  let rateLimit: RateLimitResult | undefined;
  try {
    const { address } = await context.params;
    const owner = normalizeSuiAddress(address);
    rateLimit = await enforceRateLimit(request, "wallet-activity", 60);
    const config = getServerConfig();
    const before = optionalCursor(request.nextUrl.searchParams.get("before"), "before");
    const after = optionalCursor(request.nextUrl.searchParams.get("after"), "after");
    if (before && after) throw new AppError("BAD_REQUEST", "Use either before or after, not both.");

    const rawLimit = request.nextUrl.searchParams.get("limit");
    const limit = rawLimit == null
      ? config.walletActivityLimit
      : requireInteger(rawLimit, "limit", 5, 100);

    const result = await listTransactionsBySenderGrpc(owner, limit, before, after);
    return jsonNoStore({ ok: true, network: config.network, owner, ...result }, {
      headers: rateLimitHeaders(rateLimit),
    });
  } catch (cause) {
    return apiErrorResponse(cause, "Unable to fetch wallet activity.", rateLimit);
  }
}
