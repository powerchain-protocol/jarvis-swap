import type { UserPreferences } from "@/types/preferences";
import { DEFAULT_USER_PREFERENCES } from "@/types/preferences";
import { STORAGE_KEYS } from "@/constants/storage";
import { readStorageJson, writeStorageJson } from "@/utils/storage";

function normalizePreferences(value: unknown): UserPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<UserPreferences>;
  return {
    ...DEFAULT_USER_PREFERENCES,
    ...(candidate.fiatCurrency === "USD" || candidate.fiatCurrency === "EUR" ? { fiatCurrency: candidate.fiatCurrency } : {}),
    ...(typeof candidate.hideSmallBalances === "boolean" ? { hideSmallBalances: candidate.hideSmallBalances } : {}),
    ...(typeof candidate.hideUnverifiedTokens === "boolean" ? { hideUnverifiedTokens: candidate.hideUnverifiedTokens } : {}),
    ...(["24H", "7D", "30D", "90D"].includes(String(candidate.portfolioRange)) ? { portfolioRange: candidate.portfolioRange! } : {}),
    ...(["all", "submitted", "confirmed", "failed"].includes(String(candidate.transactionStatus)) ? { transactionStatus: candidate.transactionStatus! } : {}),
    ...(["value", "symbol", "balance"].includes(String(candidate.tokenSort)) ? { tokenSort: candidate.tokenSort! } : {}),
  };
}

export function readPreferences(): UserPreferences {
  return readStorageJson(STORAGE_KEYS.preferences, DEFAULT_USER_PREFERENCES, normalizePreferences, 8 * 1024);
}

export function writePreferences(next: UserPreferences) {
  const normalized = normalizePreferences(next) ?? DEFAULT_USER_PREFERENCES;
  if (writeStorageJson(STORAGE_KEYS.preferences, normalized, 8 * 1024) && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("jarvis-swap:preferences", { detail: normalized }));
  }
  return normalized;
}
