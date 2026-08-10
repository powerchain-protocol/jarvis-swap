import { NextRequest } from "next/server";
import { fetchMarketRate } from "@/services/rates";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const limit = await enforceRateLimit(request, "market-rates", 120);
    const base = (request.nextUrl.searchParams.get("base") ?? "SUI").slice(0, 16);
    const quote = (request.nextUrl.searchParams.get("quote") ?? "USDC").slice(0, 16);
    const result = await fetchMarketRate(base, quote);
    return jsonNoStore(result, { headers: rateLimitHeaders(limit) });
  } catch (cause) { return apiErrorResponse(cause, "Unable to fetch market rate."); }
}
