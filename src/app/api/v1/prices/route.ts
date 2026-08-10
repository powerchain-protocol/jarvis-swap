import { NextRequest, NextResponse } from "next/server";
import { getServerConfig } from "@/config/env";
import { fetchBestPrice } from "@/services/prices";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { apiErrorResponse } from "@/utils/api-response";
import { withConcurrencyBudget } from "@/services/security/concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set<string>(["SUI", "USDC", "JARVIS", "CCT"]);
const CACHE_CONTROL = "public, s-maxage=10, stale-while-revalidate=20";

export async function GET(request: NextRequest) {
  let limit;
  try {
    limit = await enforceRateLimit(request, "prices", 120);
    const config = getServerConfig();
    const rawSymbols = request.nextUrl.searchParams.get("symbols") ?? "SUI,USDC,JARVIS,CCT";
    if (rawSymbols.length > 128) return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Price symbol query is too long." } }, { status: 400, headers: rateLimitHeaders(limit) });
    const requested: string[] = rawSymbols
      .split(",")
      .map((symbol: string) => symbol.trim().toUpperCase())
      .filter((symbol: string) => ALLOWED.has(symbol));
    const unique: string[] = [...new Set<string>(requested)];
    if (!unique.length) return NextResponse.json({ prices: [], errors: [] }, { headers: { ...rateLimitHeaders(limit), "cache-control": CACHE_CONTROL } });

    const settled = await withConcurrencyBudget(
      "prices-upstream",
      { concurrency: config.priceConcurrency, queueLimit: config.requestQueueLimit, waitMs: config.requestQueueWaitMs },
      () => Promise.allSettled(unique.map(async (symbol: string) => fetchBestPrice({
        symbol,
        coinType: config.tokenTypes[symbol as keyof typeof config.tokenTypes],
        pythFeedId: config.pythFeedIds[symbol],
        cmcId: config.coinMarketCapIds[symbol],
        coingeckoId: config.coinGeckoIds[symbol],
      }))),
    );
    const prices = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    // Do not expose provider/config internals to public clients; consumers only need
    // to know which requested symbol was unavailable. Server logs/observability can
    // retain detailed upstream causes separately.
    const errors = settled.flatMap((result, index) => result.status === "rejected"
      ? [{ symbol: unique[index], error: "Price unavailable" }]
      : []);

    return NextResponse.json(
      { prices, errors, providerOrder: config.priceProviderOrder },
      {
        status: prices.length ? 200 : 503,
        headers: { ...rateLimitHeaders(limit), "cache-control": prices.length ? CACHE_CONTROL : "no-store" },
      },
    );
  } catch (cause) {
    return apiErrorResponse(cause, "Unable to fetch market prices.", limit);
  }
}
