import { JARVIS_SWAP_METADATA, type TrustedTokenMetadata } from "@/metadata/metadata";
import { assertCoinType } from "@/services/sui/address";
import type { SuiNetwork } from "@/types/clusters";

export type TrustedTokenConfig = {
  network: SuiNetwork;
  tokenTypes: {
    SUI: string;
    USDC?: string;
    JARVIS?: string;
    CCT?: string;
  };
  additionalTrustedCoinTypes?: Record<string, string>;
};

const MAINNET_USDC = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const RESERVED_SYMBOLS = new Set(["SUI", "USDC", "JARVIS", "CCT"]);

function canonicalCoinType(value: string) {
  return assertCoinType(value, "trusted token coin type");
}

/**
 * Operator-controlled trusted list. Browser-imported tokens never enter this list.
 * Trust is established only by canonical exact coin type + active Sui network.
 * Conflicting symbols are rejected instead of allowing an operator typo to make
 * an unrelated coin look like a canonical asset in the UI.
 */
export function buildTrustedTokenList(config: TrustedTokenConfig): TrustedTokenMetadata[] {
  const items: TrustedTokenMetadata[] = [];
  const symbols = new Map<string, string>();
  const coinTypes = new Set<string>();

  const add = (symbolInput: string, rawCoinType: string | undefined, name: string, decimals: number, source: "protocol" | "deployment" = "deployment") => {
    if (!rawCoinType) return;
    const coinType = canonicalCoinType(rawCoinType);
    const symbol = symbolInput.toUpperCase().slice(0, 32);
    const previousType = symbols.get(symbol);
    if (previousType && previousType !== coinType) throw new Error(`Trusted token symbol ${symbol} maps to more than one coin type.`);
    if (coinTypes.has(coinType)) return;
    symbols.set(symbol, coinType);
    coinTypes.add(coinType);
    items.push({ network: "sui", networkName: config.network, coinType, symbol, name, decimals, verification: "verified", source, trusted: true });
  };

  add("SUI", config.tokenTypes.SUI, "Sui", 9, "protocol");
  add("USDC", config.tokenTypes.USDC, "USD Coin", 6, config.network === "mainnet" && config.tokenTypes.USDC === MAINNET_USDC ? "protocol" : "deployment");
  add("JARVIS", config.tokenTypes.JARVIS, "Jarvis AI", 6);
  add("CCT", config.tokenTypes.CCT, "Carbon Credit Token", 6);

  for (const [rawSymbol, rawCoinType] of Object.entries(config.additionalTrustedCoinTypes ?? {})) {
    const symbol = rawSymbol.toUpperCase().slice(0, 32);
    const coinType = canonicalCoinType(rawCoinType);
    if (RESERVED_SYMBOLS.has(symbol)) {
      const configured = symbols.get(symbol);
      if (configured !== coinType) throw new Error(`TRUSTED_TOKEN_COIN_TYPES cannot override reserved symbol ${symbol}.`);
      continue;
    }
    add(symbol, coinType, symbol, 0);
  }

  return items;
}

export function isTrustedCoinType(list: readonly TrustedTokenMetadata[], rawCoinType: string) {
  let coinType: string;
  try { coinType = canonicalCoinType(rawCoinType); } catch { return false; }
  return list.some((token) => token.coinType === coinType);
}

export const TRUST_POLICY = {
  maxServiceFeeBps: JARVIS_SWAP_METADATA.serviceFeeMaxBps,
  userImportedTokensTrusted: false,
  reservedSymbols: ["SUI", "USDC", "JARVIS", "CCT"] as const,
} as const;
