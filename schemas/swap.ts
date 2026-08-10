import { assertCoinType, normalizeSuiAddress } from "@/services/sui/address";

export type PersistedSwapInput = {
  digest: string; quoteId?: string; walletAddress: string; network: "mainnet" | "testnet" | "devnet";
  grossAmountInBaseUnits: string; minimumOutBaseUnits: string; serviceFeeBaseUnits: string; serviceFeeBps: number; feeRecipient?: string; feeCoinType?: string;
};
const BASE_UNITS = /^\d{1,78}$/;
export function parsePersistedSwap(value: PersistedSwapInput): PersistedSwapInput {
  if (!/^[A-Za-z0-9]{20,128}$/.test(value.digest)) throw new Error("Invalid transaction digest.");
  for (const [name, raw] of Object.entries({ grossAmountInBaseUnits: value.grossAmountInBaseUnits, minimumOutBaseUnits: value.minimumOutBaseUnits, serviceFeeBaseUnits: value.serviceFeeBaseUnits })) {
    if (!BASE_UNITS.test(raw)) throw new Error(`${name} must contain unsigned base units.`);
  }
  if (!Number.isInteger(value.serviceFeeBps) || value.serviceFeeBps < 0 || value.serviceFeeBps > 250) throw new Error("Service fee must be between 0 and 250 bps.");
  const feeRecipient = value.feeRecipient ? normalizeSuiAddress(value.feeRecipient) : undefined;
  if (BigInt(value.serviceFeeBaseUnits) > 0n && (!feeRecipient || !value.feeCoinType)) throw new Error("Fee recipient and coin type are required when a service fee is collected.");
  return { ...value, walletAddress: normalizeSuiAddress(value.walletAddress), feeRecipient, feeCoinType: value.feeCoinType ? assertCoinType(value.feeCoinType, "feeCoinType") : undefined };
}
