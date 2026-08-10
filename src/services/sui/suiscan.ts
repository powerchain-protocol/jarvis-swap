import type { PublicSuiNetwork } from "@/constants/network";
import { normalizeSuiAddress } from "@/services/sui/address";

const BASE = "https://suiscan.xyz";

export function suiscanBaseUrl(network: PublicSuiNetwork) {
  return `${BASE}/${network}`;
}
export function suiscanTransactionUrl(network: PublicSuiNetwork, digest: string) {
  const value = digest.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(value)) throw new Error("Invalid Sui transaction digest.");
  return `${suiscanBaseUrl(network)}/tx/${encodeURIComponent(value)}`;
}
export function suiscanAddressUrl(network: PublicSuiNetwork, address: string) {
  return `${suiscanBaseUrl(network)}/account/${normalizeSuiAddress(address)}`;
}
export function suiscanObjectUrl(network: PublicSuiNetwork, objectId: string) {
  return `${suiscanBaseUrl(network)}/object/${normalizeSuiAddress(objectId)}`;
}
