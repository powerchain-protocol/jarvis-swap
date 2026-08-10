import "server-only";
import { createHash } from "node:crypto";
import { getServerConfig } from "@/config/env";
import { buildTrustedTokenList, isTrustedCoinType } from "@/data/trusted-token-list";
import { assertCoinType } from "@/services/sui/address";
import { discoverToken } from "@/services/tokens/discovery";

export function getTrustedTokenList() {
  const config = getServerConfig();
  return buildTrustedTokenList({
    network: config.network,
    tokenTypes: config.tokenTypes,
    additionalTrustedCoinTypes: config.additionalTrustedCoinTypes,
  });
}

export function getTrustedTokenRegistryId() {
  const config = getServerConfig();
  const payload = getTrustedTokenList()
    .map(({ symbol, coinType, decimals, source }) => `${symbol}:${coinType}:${decimals}:${source}`)
    .sort()
    .join("|");
  return createHash("sha256").update(`${config.network}|${payload}`).digest("hex");
}

export function findTrustedToken(rawCoinType: string) {
  let coinType: string;
  try { coinType = assertCoinType(rawCoinType, "coin type"); } catch { return undefined; }
  return getTrustedTokenList().find((token) => token.coinType === coinType);
}

export async function resolveTrustedToken(rawCoinType: string) {
  const coinType = assertCoinType(rawCoinType, "coin type");
  const trusted = findTrustedToken(coinType);
  if (!trusted) return { ...(await discoverToken(coinType)), verified: false as const };
  const chain = await discoverToken(coinType);
  return {
    ...chain,
    coinType,
    symbol: trusted.symbol || chain.symbol,
    name: trusted.name || chain.name,
    // Preserve legitimate 0-decimal assets; do not use truthiness for numeric metadata.
    decimals: Number.isInteger(chain.decimals) && chain.symbol !== "UNKNOWN" ? chain.decimals : trusted.decimals,
    verified: true as const,
  };
}

export function isTrustedToken(coinType: string) {
  return isTrustedCoinType(getTrustedTokenList(), coinType);
}
