import { normalizeSuiAddress } from "@/services/sui/address";
export type PoolRecordInput = { network: "mainnet" | "testnet" | "devnet"; poolId: string; feeRateBps?: number; tickSpacing?: number };
export function parsePoolRecord(value: PoolRecordInput): PoolRecordInput {
  const poolId = normalizeSuiAddress(value.poolId);
  if (value.feeRateBps != null && (!Number.isInteger(value.feeRateBps) || value.feeRateBps < 0 || value.feeRateBps > 10_000)) throw new Error("Invalid pool fee rate.");
  if (value.tickSpacing != null && (!Number.isInteger(value.tickSpacing) || value.tickSpacing <= 0)) throw new Error("Invalid tick spacing.");
  return { ...value, poolId };
}
