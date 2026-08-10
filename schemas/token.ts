import { assertCoinType } from "@/services/sui/address";
import { normalizeSymbol } from "@/utils/tokens";

export type TokenRecordInput = { network: "mainnet" | "testnet" | "devnet"; coinType: string; symbol: string; name: string; decimals: number; logoUrl?: string; verified?: boolean; metadata?: unknown };
export function parseTokenRecord(value: TokenRecordInput): TokenRecordInput {
  if (!Number.isInteger(value.decimals) || value.decimals < 0 || value.decimals > 18) throw new Error("Token decimals must be between 0 and 18.");
  const name = value.name.trim();
  if (!name || name.length > 120) throw new Error("Invalid token name.");
  return { ...value, coinType: assertCoinType(value.coinType, "coinType"), symbol: normalizeSymbol(value.symbol), name };
}
