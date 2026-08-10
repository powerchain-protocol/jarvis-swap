import "server-only";
import { getPrisma } from "../client";
import type { LiquidityAccount } from "@/services/pools/accounting";
import type { PoolSummary } from "@/types/pools";

function asDecimal(value?: string | null) { return value && /^\d+$/.test(value) ? value : undefined; }

export async function persistLiquidityAccount(account: LiquidityAccount, pools: PoolSummary[]) {
  const prisma = getPrisma();
  const wallet = await prisma.wallet.upsert({
    where: { address: account.owner },
    create: { address: account.owner, network: account.network },
    update: { network: account.network },
  });

  const poolRows = new Map<string, string>();
  for (const pool of pools.filter((p) => p.exists)) {
    const row = await prisma.liquidityPool.upsert({
      where: { network_poolId: { network: account.network, poolId: pool.id } },
      create: {
        network: account.network,
        poolId: pool.id,
        currentSqrtPrice: asDecimal(pool.currentSqrtPrice),
        liquidity: asDecimal(pool.liquidity),
        tickSpacing: pool.tickSpacing && /^\d+$/.test(pool.tickSpacing) ? Number(pool.tickSpacing) : undefined,
        raw: pool as never,
      },
      update: {
        currentSqrtPrice: asDecimal(pool.currentSqrtPrice),
        liquidity: asDecimal(pool.liquidity),
        tickSpacing: pool.tickSpacing && /^\d+$/.test(pool.tickSpacing) ? Number(pool.tickSpacing) : undefined,
        raw: pool as never,
        lastSyncedAt: new Date(),
      },
    });
    poolRows.set(pool.id, row.id);
    await prisma.liquidityPoolSnapshot.create({
      data: {
        liquidityPoolId: row.id,
        currentTickIndex: pool.currentTickIndex ?? undefined,
        currentSqrtPrice: asDecimal(pool.currentSqrtPrice),
        liquidity: asDecimal(pool.liquidity),
      },
    });
  }

  for (const position of account.positions) {
    const row = await prisma.liquidityPosition.upsert({
      where: { network_objectId: { network: account.network, objectId: position.objectId } },
      create: {
        network: account.network,
        objectId: position.objectId,
        walletId: wallet.id,
        poolId: position.poolObjectId ? poolRows.get(position.poolObjectId) : undefined,
        tickLower: position.tickLower ?? undefined,
        tickUpper: position.tickUpper ?? undefined,
        liquidity: asDecimal(position.liquidity),
        raw: position.raw as never,
      },
      update: {
        walletId: wallet.id,
        poolId: position.poolObjectId ? poolRows.get(position.poolObjectId) : undefined,
        tickLower: position.tickLower ?? undefined,
        tickUpper: position.tickUpper ?? undefined,
        liquidity: asDecimal(position.liquidity),
        raw: position.raw as never,
        lastSyncedAt: new Date(),
      },
    });
    await prisma.liquidityPositionSnapshot.create({
      data: {
        liquidityPositionId: row.id,
        rangeState: position.rangeState,
        currentTickIndex: position.currentTickIndex ?? undefined,
        liquidity: asDecimal(position.liquidity),
        feeOwedABaseUnits: asDecimal(position.feeOwedA),
        feeOwedBBaseUnits: asDecimal(position.feeOwedB),
        rewards: position.rewardOwed ?? [],
      },
    });
  }
}

export async function persistPoolRegistry(network: "mainnet" | "testnet" | "devnet", pools: PoolSummary[]) {
  const prisma = getPrisma();
  let snapshots = 0;
  for (const pool of pools.filter((item) => item.exists)) {
    const row = await prisma.liquidityPool.upsert({
      where: { network_poolId: { network, poolId: pool.id } },
      create: {
        network, poolId: pool.id,
        currentSqrtPrice: asDecimal(pool.currentSqrtPrice), liquidity: asDecimal(pool.liquidity),
        tickSpacing: pool.tickSpacing && /^\d+$/.test(pool.tickSpacing) ? Number(pool.tickSpacing) : undefined,
        raw: pool as never,
      },
      update: {
        currentSqrtPrice: asDecimal(pool.currentSqrtPrice), liquidity: asDecimal(pool.liquidity),
        tickSpacing: pool.tickSpacing && /^\d+$/.test(pool.tickSpacing) ? Number(pool.tickSpacing) : undefined,
        raw: pool as never, lastSyncedAt: new Date(),
      },
    });
    await prisma.liquidityPoolSnapshot.create({ data: { liquidityPoolId: row.id, currentTickIndex: pool.currentTickIndex ?? undefined, currentSqrtPrice: asDecimal(pool.currentSqrtPrice), liquidity: asDecimal(pool.liquidity) } });
    snapshots += 1;
  }
  return snapshots;
}
