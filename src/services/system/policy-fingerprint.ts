import "server-only";

import { createHash } from "node:crypto";
import { getServerConfig } from "@/config/env";
import { APP_VERSION } from "@/constants/release";
import { getTrustedTokenRegistryId } from "@/services/tokens/trusted";
import { assertCoinType, normalizeSuiAddress } from "@/services/sui/address";

/**
 * Deterministic, secret-free fingerprint of the execution policy that a quote
 * is allowed to rely on. This protects rolling deployments from accepting a
 * quote created under a materially different fee/token/Move policy.
 *
 * IMPORTANT: never add secrets, API keys, raw RPC URLs, database URLs or
 * session/signing material to this payload. The hash is public metadata.
 */
export function getExecutionPolicyFingerprint() {
  const config = getServerConfig();
  const tokenTypes = Object.fromEntries(
    Object.entries(config.tokenTypes)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
      .map(([symbol, coinType]) => [symbol, assertCoinType(coinType)])
      .sort(([a], [b]) => a.localeCompare(b)),
  );

  const payload = {
    schema: 1,
    release: APP_VERSION,
    network: config.network,
    feeBps: config.feeBps,
    feeRecipient: config.feeWallet ? normalizeSuiAddress(config.feeWallet) : null,
    requireOnchainFee: config.requireOnchainFee,
    swapPackageId: config.swapPackageId ? normalizeSuiAddress(config.swapPackageId) : null,
    swapConfigObjectId: config.swapConfigObjectId ? normalizeSuiAddress(config.swapConfigObjectId) : null,
    maxSlippageBps: config.maxSlippageBps,
    maxPriceImpactBps: config.maxPriceImpactBps,
    trustedTokenRegistryId: getTrustedTokenRegistryId(),
    tokenTypes,
    allowedCetusProviders: [...config.allowedCetusProviders].sort(),
  };

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
