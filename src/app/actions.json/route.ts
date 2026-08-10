import { APP_VERSION } from "@/constants/release";
import { NextResponse } from "next/server";

export const revalidate = 3600;

export function GET() {
  return NextResponse.json({
    name: "JARVIS Swap",
    version: APP_VERSION,
    network: "sui",
    actions: {
      quote: { method: "POST", href: "/api/v1/swap/quote", mutatesChain: false },
      validate: { method: "POST", href: "/api/v1/swap/validate", mutatesChain: false },
      preflight: { method: "POST", href: "/api/v1/transactions/preflight", mutatesChain: false },
      execute: { method: "POST", href: "/api/v1/transactions/execute", mutatesChain: true, requiresWalletSignature: true, requiresIdempotencyKey: true },
      validateLiquidityAction: { method: "POST", href: "/api/v1/pools/actions/validate", mutatesChain: false },
    },
    protections: { maximumServiceFeeBps: 250, slippageRequired: true, preflightRequired: true, rateLimited: true, idempotentExecution: true },
  }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
