"use client";

import type { PortfolioSnapshot } from "@/types/portfolio";
import { cached, invalidateCache } from "@/utils/cache";
import { apiErrorMessage, readApiJson } from "@/utils/api-client";
import { API_ROUTES } from "@/constants/routes";

export async function fetchPortfolioClient(address: string, force = false, signal?: AbortSignal): Promise<PortfolioSnapshot> {
  const normalized = address.trim().toLowerCase();
  if (!normalized) throw new Error("Wallet address is required.");
  const key = `portfolio-client:${normalized}`;
  if (force) invalidateCache(key);
  return cached(key, 10_000, async () => {
    const response = await fetch(`${API_ROUTES.portfolio(address)}${force ? "?refresh=1" : ""}`, { cache: "no-store", signal });
    const payload = await readApiJson<PortfolioSnapshot & { error?: unknown; message?: string }>(response);
    if (!response.ok || !payload) throw new Error(apiErrorMessage(payload, "Unable to load portfolio."));
    return payload;
  });
}
