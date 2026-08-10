import type { NextRequest } from "next/server";
import { fetchPortfolio } from "@/services/portfolio/valuation";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { discoverToken } from "@/services/tokens/discovery";
import { normalizeSuiAddress } from "@/services/sui/address";
import type { PortfolioAsset } from "@/types/portfolio";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let limit;
  try {
    limit = await enforceRateLimit(request, "token-search", 60);
    const rawQuery = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 256);
    const query = rawQuery.toLowerCase();
    const rawOwner = request.nextUrl.searchParams.get("owner")?.trim();
    if (!rawOwner) return jsonNoStore({ tokens: [], total: 0 }, { headers: rateLimitHeaders(limit) });

    const owner = normalizeSuiAddress(rawOwner);
    const portfolio = await fetchPortfolio(owner);
    let tokens: PortfolioAsset[] = portfolio.assets.filter((token) =>
      !query ||
      token.symbol.toLowerCase().includes(query) ||
      token.name.toLowerCase().includes(query) ||
      token.coinType.toLowerCase().includes(query),
    );

    // Exact Sui coin-type lookup is metadata discovery only. It must never
    // inherit verification or a wallet balance unless it came from the wallet.
    if (!tokens.length && rawQuery.includes("::")) {
      try {
        const token = await discoverToken(rawQuery);
        tokens = [{
          ...token,
          balanceBaseUnits: "0",
          balance: "0",
          priceFreshness: "unpriced",
          allocationPct: 0,
        }];
      } catch {
        // Search misses are expected for arbitrary user input.
      }
    }

    return jsonNoStore({ tokens, total: tokens.length }, { headers: rateLimitHeaders(limit) });
  } catch (cause) {
    return apiErrorResponse(cause, "Token search failed.", limit);
  }
}
