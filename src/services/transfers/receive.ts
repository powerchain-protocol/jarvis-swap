"use client";
import { normalizeSuiAddress } from "@/services/sui/address";
import { suiscanAddressUrl } from "@/services/sui/suiscan";
import type { PublicSuiNetwork } from "@/constants/network";

export function receiveDetails(address: string, network: PublicSuiNetwork) {
  const normalized = normalizeSuiAddress(address);
  return { address: normalized, explorerUrl: suiscanAddressUrl(network, normalized) };
}
