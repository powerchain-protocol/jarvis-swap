import { NextResponse } from "next/server";
import { getServerConfig } from "@/config/env";
import { DEFAULT_SWAP_SETTINGS } from "@/config/settings";
import { getDeepBookStatus } from "@/lib/deepbook";
export const dynamic = "force-dynamic";
export async function GET() {
  const config = getServerConfig();
  const deepBook = getDeepBookStatus();
  return NextResponse.json({
    network: config.network,
    defaults: DEFAULT_SWAP_SETTINGS,
    serviceFeeBps: config.feeBps,
    maxSlippageBps: config.maxSlippageBps,
    maxPriceImpactBps: config.maxPriceImpactBps,
    quoteTtlMs: config.quoteTtlMs,
    minQuoteValidityMs: config.minQuoteValidityMs,
    signedQuotes: { enabled: Boolean(config.quoteSigningSecret), required: config.requireSignedQuotes },
    feeEnforcement: { mode: config.swapPackageId && config.swapConfigObjectId ? "move-contract" : "atomic-transfer", onchainRequired: config.requireOnchainFee, packageConfigured: Boolean(config.swapPackageId), configObjectConfigured: Boolean(config.swapConfigObjectId) },
    execution: { transport: "sui-grpc", preflightRequired: true, dedicatedRpcRequired: config.productionRpcRequired, maxGasBudgetMist: String(config.maxGasBudgetMist) },
    mevProtection: { mode: config.protectedRpcUrl ? "protected-rpc" : "min-output-and-fresh-route", protectedRpcConfigured: Boolean(config.protectedRpcUrl) },
    routing: ["best-price", "lowest-impact", "custom"],
    liquiditySources: { cetus: { enabled: config.network !== "devnet" }, deepbook: deepBook },
  }, { headers: { "cache-control": "public, s-maxage=60", "x-content-type-options": "nosniff" } });
}
