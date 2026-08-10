import "server-only";
import { getServerConfig } from "@/config/env";
import { logEvent } from "@/services/observability/logger";
import { fetchCetusPositions } from "@/services/pools/positions";
import { fetchConfiguredPools } from "@/services/pools/registry";
import { databasePersistenceEnabled } from "@/services/database/persistence";
import type { PoolPosition } from "@/types/pools";

export type LiquidityAccount = {
  owner: string;
  network: "mainnet" | "testnet" | "devnet";
  configured: boolean;
  positions: PoolPosition[];
  totals: { positions: number; inRange: number; outOfRange: number; unknownRange: number };
  fetchedAt: number;
};

export async function fetchLiquidityAccount(owner: string): Promise<LiquidityAccount> {
  const config = getServerConfig();
  const poolResult = await fetchConfiguredPools();
  const currentTicks = new Map(poolResult.pools.map((pool) => [pool.id, pool.currentTickIndex ?? null]));
  const result = await fetchCetusPositions(owner, currentTicks);
  const positions = result.positions;
  const account: LiquidityAccount = {
    owner,
    network: config.network,
    configured: result.configured,
    positions,
    totals: {
      positions: positions.length,
      inRange: positions.filter((position) => position.rangeState === "in-range").length,
      outOfRange: positions.filter((position) => position.rangeState === "below-range" || position.rangeState === "above-range").length,
      unknownRange: positions.filter((position) => position.rangeState === "unknown").length,
    },
    fetchedAt: Date.now(),
  };
  if (databasePersistenceEnabled()) {
    try {
      const { persistLiquidityAccount } = await import("@db/prisma/repositories/liquidity");
      await persistLiquidityAccount(account, poolResult.pools);
    } catch (cause) {
      logEvent("error", "liquidity.persistence_failed", {}, cause);
    }
  }
  return account;
}
