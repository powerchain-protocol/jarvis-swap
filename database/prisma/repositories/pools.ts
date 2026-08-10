import "server-only";
import { getPrisma } from "../client";

export async function upsertPool(input: { network: "mainnet" | "testnet" | "devnet"; poolId: string; feeRateBps?: number; tickSpacing?: number; liquidity?: string; currentSqrtPrice?: string; raw?: unknown }) {
  const prisma = getPrisma();
  return prisma.liquidityPool.upsert({
    where: { network_poolId: { network: input.network, poolId: input.poolId } },
    create: { ...input, raw: input.raw as never },
    update: { feeRateBps: input.feeRateBps, tickSpacing: input.tickSpacing, liquidity: input.liquidity, currentSqrtPrice: input.currentSqrtPrice, raw: input.raw as never, lastSyncedAt: new Date() },
  });
}
