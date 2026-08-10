export type KnownTokenSymbol = "SUI" | "USDC" | "JARVIS" | "CCT";

export const CANONICAL_SUI_COIN_TYPE = "0x2::sui::SUI" as const;
export const SUI_MAINNET_USDC_COIN_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC" as const;

export function tokenKey(network: "mainnet" | "testnet" | "devnet", coinType: string) {
  return `${network}:${coinType}`;
}

export function baseUnitsToDecimal(value: bigint | string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) throw new Error("Token decimals must be between 0 and 18.");
  const raw = typeof value === "bigint" ? value : BigInt(value);
  const negative = raw < 0n;
  const absolute = negative ? -raw : raw;
  const divisor = 10n ** BigInt(decimals);
  const integer = absolute / divisor;
  const fraction = decimals ? (absolute % divisor).toString().padStart(decimals, "0").replace(/0+$/, "") : "";
  return `${negative ? "-" : ""}${integer}${fraction ? `.${fraction}` : ""}`;
}

export function normalizeSymbol(symbol: string) {
  const value = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9._-]{1,32}$/.test(value)) throw new Error("Invalid token symbol.");
  return value;
}

export function isConfiguredCoinType(value: string | undefined): value is string {
  return Boolean(value && value.includes("::") && value.startsWith("0x"));
}
