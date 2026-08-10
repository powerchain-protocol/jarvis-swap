import { normalizeSuiAddress } from "@/services/sui/address";

export type WalletRecordInput = { address: string; network: "mainnet" | "testnet" | "devnet"; label?: string };
export function parseWalletRecord(value: WalletRecordInput): WalletRecordInput {
  if (value.network !== "mainnet" && value.network !== "testnet") throw new Error("Invalid Sui network.");
  const label = value.label?.trim();
  if (label && label.length > 80) throw new Error("Wallet label is too long.");
  return { address: normalizeSuiAddress(value.address), network: value.network, label: label || undefined };
}
