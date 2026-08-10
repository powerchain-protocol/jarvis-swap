"use client";

import type { PublicSuiNetwork } from "@/constants/network";
import { suiscanTransactionUrl } from "@/services/sui/suiscan";

export type SwapActivityStatus = "submitted" | "confirmed" | "failed";
export type SwapActivity = {
  digest: string;
  account: string;
  paySymbol: string;
  receiveSymbol: string;
  amountIn: string;
  amountOut: string;
  serviceFeeAmount: string;
  serviceFeeBps: number;
  status: SwapActivityStatus;
  createdAt: number;
  updatedAt: number;
};
const KEY = "jarvis-swap:activity:v1";
export function readSwapActivity(): SwapActivity[] {
  if (typeof window === "undefined") return [];
  try { const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]") as SwapActivity[]; return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.digest === "string").slice(0, 250) : []; }
  catch { return []; }
}
export function upsertSwapActivity(activity: SwapActivity, maxItems = 50) {
  if (typeof window === "undefined") return;
  const next = [activity, ...readSwapActivity().filter((item) => item.digest !== activity.digest)].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0, Math.max(10, Math.min(250,maxItems)));
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("jarvis-swap:activity-updated"));
}
export function explorerUrl(network: PublicSuiNetwork, digest: string) { return suiscanTransactionUrl(network, digest); }
