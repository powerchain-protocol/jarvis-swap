import type { NextRequest } from "next/server";
import { fetchPortfolio } from "@/services/portfolio/valuation";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";
import { getServerConfig } from "@/config/env";
import { withConcurrencyBudget } from "@/services/security/concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  let limit;
  try {
    limit = await enforceRateLimit(request, "portfolio", 30);
    const { address } = await params;
    const config = getServerConfig();
    const data = await withConcurrencyBudget(
      "portfolio-upstream",
      { concurrency: config.portfolioConcurrency, queueLimit: config.requestQueueLimit, waitMs: config.requestQueueWaitMs },
      () => fetchPortfolio(address, request.nextUrl.searchParams.get("refresh") === "1"),
    );
    return jsonNoStore(data, { headers: rateLimitHeaders(limit) });
  } catch (cause) {
    return apiErrorResponse(cause, "Unable to value portfolio.", limit);
  }
}
