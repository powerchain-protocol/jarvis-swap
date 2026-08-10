"use client";
import { fetchJson } from "@/common/fetch-json";
import type { WalletActivityPage } from "@/types/transactions";
import { API_ROUTES } from "@/constants/routes";

export async function fetchWalletActivity(address: string, options: { before?: string | null; after?: string | null; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.before) params.set("before", options.before);
  if (options.after) params.set("after", options.after);
  if (options.limit) params.set("limit", String(options.limit));
  const suffix = params.size ? `?${params}` : "";
  const payload = await fetchJson<{ ok: true } & WalletActivityPage>(`${API_ROUTES.walletActivity(address)}${suffix}`, { cache: "no-store", timeoutMs: 10_000, retries: 1 });
  return payload;
}
