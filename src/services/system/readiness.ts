import "server-only";

import { getServerConfig } from "@/config/env";
import { getDeepBookStatus } from "@/lib/deepbook";
import { isSwapExecutionConfigured } from "@/services/swap";
import { dedicatedRpcViolations } from "@/services/sui/rpc-policy";
import { getSwapOperationsState } from "@/services/system/operations";

export type SwapReadiness = {
  network: "mainnet" | "testnet" | "devnet";
  executionEnabled: boolean;
  blockers: string[];
  warnings: string[];
  rpc: {
    dedicatedRequired: boolean;
    endpointCount: number;
    protectedSubmission: boolean;
  };
  liquidity: {
    cetus: { enabled: boolean; providerPolicy: "allowlist" | "all-known"; providerCount: number };
    deepbook: ReturnType<typeof getDeepBookStatus>;
  };
};

export function getSwapReadiness(): SwapReadiness {
  const config = getServerConfig();
  const execution = isSwapExecutionConfigured();
  const blockers: string[] = [];
  const warnings: string[] = [];
  const operations = getSwapOperationsState(config);

  if (!operations.enabled && config.network !== "devnet") blockers.push(operations.reason ?? "Swap operations are disabled.");
  if (!config.feeWallet && config.feeBps > 0) blockers.push("JARVIS_SWAP_FEE_WALLET is TBA.");
  if (config.network === "devnet") blockers.push("Cetus swap execution is disabled on Devnet.");
  if (config.requireSignedQuotes && !config.quoteSigningSecret) blockers.push("Signed quotes are required but JARVIS_QUOTE_SIGNING_SECRET is missing.");
  if (config.requireWalletSession && !process.env.JARVIS_SESSION_SECRET?.trim()) blockers.push("Wallet sessions are required but JARVIS_SESSION_SECRET is missing.");
  if (config.requireWalletSession && !process.env.NEXT_PUBLIC_APP_URL?.trim()) blockers.push("Wallet sessions are required but NEXT_PUBLIC_APP_URL is missing.");
  if (config.requireOnchainFee && (!config.swapPackageId || !config.swapConfigObjectId)) blockers.push("On-chain fee enforcement is required but the Move package/config object is incomplete.");
  blockers.push(...dedicatedRpcViolations({
    network: config.network,
    requireDedicated: config.productionRpcRequired,
    grpcUrls: config.grpcUrls,
    protectedRpcUrl: config.protectedRpcUrl,
  }));

  if (!config.tokenTypes.JARVIS) warnings.push("JARVIS_SUI_COIN_TYPE is not configured.");
  if (!config.tokenTypes.CCT) warnings.push("CCT_SUI_COIN_TYPE is not configured.");
  if (!config.tokenTypes.USDC && config.network !== "mainnet") warnings.push("SUI_USDC_COIN_TYPE must be configured explicitly outside Mainnet.");
  if (!config.allowedCetusProviders.length) warnings.push("CETUS_ALLOWED_PROVIDERS is empty; all SDK-known providers are eligible.");
  if (config.network !== "mainnet" && config.productionRpcRequired) warnings.push("Dedicated-RPC policy only gates Mainnet production execution.");

  return {
    network: config.network,
    executionEnabled: execution.enabled && blockers.length === 0,
    blockers,
    warnings,
    rpc: {
      dedicatedRequired: config.productionRpcRequired && config.network === "mainnet",
      endpointCount: config.grpcUrls.length,
      protectedSubmission: Boolean(config.protectedRpcUrl),
    },
    liquidity: {
      cetus: {
        enabled: config.network !== "devnet",
        providerPolicy: config.allowedCetusProviders.length ? "allowlist" : "all-known",
        providerCount: config.allowedCetusProviders.length,
      },
      deepbook: getDeepBookStatus(),
    },
  };
}
