import { API_ROUTES } from "@/constants/routes";
import type { Token } from "@/services/quotes/types";
import { cached, invalidateCache, withAbortSignal } from "@/utils/cache";
import { baseUnitsToDecimalString } from "@/services/fees/service-fee";
import { apiErrorMessage, readApiJson } from "@/utils/api-client";
import { assertCoinType, normalizeSuiAddress } from "@/services/sui/address";

export type WalletData = { address: string; balances: Array<{ coinType: string; totalBalance: string; coinObjectCount: number }> };

function parseWalletData(value: unknown): WalletData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.address !== "string" || !Array.isArray(record.balances) || record.balances.length > 5_000) return null;
  let address: string;
  try { address = normalizeSuiAddress(record.address); } catch { return null; }
  const balances: WalletData["balances"] = [];
  for (const raw of record.balances) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (typeof item.coinType !== "string" || typeof item.totalBalance !== "string" || !/^\d+$/.test(item.totalBalance)) return null;
    let coinType: string;
    try { coinType = assertCoinType(item.coinType, "wallet balance coin type"); } catch { return null; }
    const count = typeof item.coinObjectCount === "number" && Number.isInteger(item.coinObjectCount) && item.coinObjectCount >= 0 ? item.coinObjectCount : 0;
    balances.push({ coinType, totalBalance: item.totalBalance, coinObjectCount: count });
  }
  return { address, balances };
}
const WALLET_CACHE_MS = 5_000;

export async function fetchWalletData(address: string, signal?: AbortSignal, force = false): Promise<WalletData> {
  const key = `wallet:${address.toLowerCase()}`;
  if (force) invalidateCache(key);
  const shared = cached(key, WALLET_CACHE_MS, async () => {
    // Do not bind a caller-owned AbortSignal to the shared in-flight request.
    // One component cancelling must not poison the deduplicated request for other consumers.
    const response = await fetch(API_ROUTES.wallet(address), { cache: "no-store" });
    const payload = await readApiJson<unknown>(response);
    if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to fetch wallet data."));
    const wallet = parseWalletData(payload);
    if (!wallet) throw new Error("Wallet API returned an invalid response.");
    return wallet;
  });
  return withAbortSignal(shared, signal);
}

export function applyWalletBalances(tokens: Token[], data: WalletData): Token[] {
  const byType = new Map(data.balances.map((balance) => [balance.coinType, balance]));
  return tokens.map((token) => {
    if (!token.coinType) return token;
    let coinType: string;
    try { coinType = assertCoinType(token.coinType, "token coin type"); }
    catch { return { ...token, balance: 0, balanceText: "0", balanceBaseUnits: "0" }; }
    const balance = byType.get(coinType);
    if (!balance) return { ...token, balance: 0, balanceText: "0", balanceBaseUnits: "0" };
    const balanceText = baseUnitsToDecimalString(BigInt(balance.totalBalance), token.decimals);
    const numeric = Number(balanceText);
    return {
      ...token,
      coinType,
      balance: Number.isFinite(numeric) ? numeric : 0,
      balanceText,
      balanceBaseUnits: balance.totalBalance,
    };
  });
}
