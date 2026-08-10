"use client";
import { API_ROUTES } from "@/constants/routes";
import { apiErrorMessage, readApiJson } from "@/utils/api-client";

export type MarketRate = { base: string; quote: string; rate: number; inverseRate: number; baseUsd?: number; quoteUsd?: number; updatedAt: number; sources: string[] };

export async function fetchMarketRate(base: string, quote: string, signal?: AbortSignal): Promise<MarketRate> {
  const params = new URLSearchParams({ base: base.toUpperCase(), quote: quote.toUpperCase() });
  const response = await fetch(`${API_ROUTES.rates}?${params}`, { cache: "no-store", signal });
  const payload = await readApiJson<MarketRate & { error?: unknown }>(response);
  if (!response.ok || !payload || !Number.isFinite(payload.rate) || payload.rate <= 0) throw new Error(apiErrorMessage(payload, "Unable to fetch market rate."));
  return payload;
}

export function convertByRate(amount: number, rate: number) {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate <= 0) throw new Error("Invalid conversion input.");
  return amount * rate;
}
