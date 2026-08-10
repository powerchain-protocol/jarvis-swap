import { NextResponse } from "next/server";
import { getServerConfig } from "@/config/env";
import { getDeepBookStatus } from "@/lib/deepbook";
import { getTrustedTokenList, getTrustedTokenRegistryId } from "@/services/tokens/trusted";
import { getRpcConfiguration } from "@/services/sui/rpc-config";
import { getSwapOperationsState } from "@/services/system/operations";
import { getExecutionPolicyFingerprint } from "@/services/system/policy-fingerprint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getServerConfig();
    const deepBook = getDeepBookStatus();
    const rpc = getRpcConfiguration();
    const trustedTokens = getTrustedTokenList();
    const operations = getSwapOperationsState(config);
    return NextResponse.json({
      network: config.network,
      policyFingerprint: getExecutionPolicyFingerprint(),
      cluster: rpc.cluster,
      clusterLabel: rpc.label,
      swapExecutionEnabled: operations.enabled && (config.feeBps === 0 || Boolean(config.feeWallet)),
      swapOperationsEnabled: operations.enabled,
      swapOperationsReason: operations.reason,
      feeBps: config.feeBps,
      feeWallet: config.feeWallet,
      feeWalletStatus: config.feeWallet ? "configured" : "tba",
      networkFeeRecipient: "Sui network",
      walletSessionRequired: config.requireWalletSession,
      cetusEndpoint: config.cetusEndpoint,
      pythUrls: config.pythUrls,
      tokenTypes: config.tokenTypes,
      trustedTokenTypes: Object.fromEntries(trustedTokens.map((token) => [token.symbol, token.coinType])),
      trustedTokenRegistryId: getTrustedTokenRegistryId(),
      maxSlippageBps: config.maxSlippageBps,
      maxPriceImpactBps: config.maxPriceImpactBps,
      protectedRpcConfigured: Boolean(config.protectedRpcUrl),
      swapPackageId: config.swapPackageId,
      swapConfigObjectId: config.swapConfigObjectId,
      requireOnchainFee: config.requireOnchainFee,
      minQuoteValidityMs: config.minQuoteValidityMs,
      allowedCetusProviders: config.allowedCetusProviders,
      liquiditySources: { cetus: { enabled: config.network !== "devnet" }, deepbook: deepBook },
      gasReserveMist: config.gasReserveMist,
      activityMaxItems: config.activityMaxItems,
    }, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (cause) {
    return NextResponse.json({ error: "Swap configuration is unavailable." }, { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }
}
