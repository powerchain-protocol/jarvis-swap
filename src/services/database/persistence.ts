import "server-only";
import { getServerConfig } from "@/config/env";
import { logEvent } from "@/services/observability/logger";
import { parsePersistedSwap, type PersistedSwapInput } from "@schemas/swap";

export function databasePersistenceEnabled() {
  return process.env.DATABASE_PERSISTENCE_ENABLED === "true" && Boolean(process.env.DATABASE_URL?.trim());
}

export async function observeWalletBestEffort(address: string) {
  if (!databasePersistenceEnabled()) return;
  try {
    const { upsertWallet } = await import("@db/prisma/repositories/wallets");
    await upsertWallet(address, getServerConfig().network);
  } catch (cause) {
    logEvent("error", "database.wallet.persistence_failed", {}, cause);
  }
}

export async function persistSubmittedSwapBestEffort(input: PersistedSwapInput) {
  if (!databasePersistenceEnabled()) return;
  try {
    const parsed = parsePersistedSwap(input);
    const { recordSubmittedSwap } = await import("@db/prisma/repositories/swaps");
    await recordSubmittedSwap(parsed);
  } catch (cause) {
    logEvent("error", "database.swap_submission.persistence_failed", {}, cause);
  }
}

export async function persistConfirmedSwapBestEffort(digest: string, checkpoint?: bigint, gasUsedMist?: string) {
  if (!databasePersistenceEnabled()) return;
  try {
    const { markSwapConfirmed } = await import("@db/prisma/repositories/swaps");
    await markSwapConfirmed(digest, checkpoint, gasUsedMist);
  } catch (cause) {
    logEvent("error", "database.swap_confirmation.persistence_failed", {}, cause);
  }
}
