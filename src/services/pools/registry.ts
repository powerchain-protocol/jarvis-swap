import "server-only";
import { getServerConfig } from "@/config/env";
import { normalizeSuiAddress } from "@/services/sui/address";
import { getObjectsGrpc } from "@/services/sui/grpc";
import { asRecord, asSafeInteger, moveString, pickField, type NormalizedSuiObject } from "@/services/sui/object-shapes";
import { cached } from "@/utils/cache";
import type { PoolSummary } from "@/types/pools";

function parsePool(object: NormalizedSuiObject, fallbackId: string): PoolSummary {
  if (object.error) {
    return { id: fallbackId, exists: false, type: null, version: null, coinTypeA: null, coinTypeB: null, feeRate: null, tickSpacing: null, currentTickIndex: null, currentSqrtPrice: null, liquidity: null };
  }

  const root = asRecord(object.json);
  const fields = asRecord(root?.fields) ?? root;
  return {
    id: object.objectId || fallbackId,
    exists: Boolean(object.objectId),
    type: object.type,
    version: object.version == null ? null : String(object.version),
    coinTypeA: moveString(pickField(fields, ["coin_type_a", "coinTypeA"])),
    coinTypeB: moveString(pickField(fields, ["coin_type_b", "coinTypeB"])),
    feeRate: moveString(pickField(fields, ["fee_rate", "feeRate"])),
    tickSpacing: moveString(pickField(fields, ["tick_spacing", "tickSpacing"])),
    currentTickIndex: asSafeInteger(moveString(pickField(fields, ["current_tick_index", "currentTickIndex", "current_tick"]))),
    currentSqrtPrice: moveString(pickField(fields, ["current_sqrt_price", "currentSqrtPrice"])),
    liquidity: moveString(pickField(fields, ["liquidity"])),
  };
}

export async function fetchConfiguredPools(): Promise<{ network: "mainnet" | "testnet" | "devnet"; provider: string; transport: "grpc"; configured: boolean; pools: PoolSummary[] }> {
  const config = getServerConfig();
  return cached(`cetus:pools:v3:${config.network}:${config.cetusPoolIds.join(",")}`, config.cetusPoolCacheTtlMs, async () => {
    const poolIds = config.cetusPoolIds.map(normalizeSuiAddress);
    if (!poolIds.length) return { network: config.network, provider: "Cetus CLMM", transport: "grpc" as const, configured: false, pools: [] };
    const objects = await getObjectsGrpc(poolIds);
    return { network: config.network, provider: "Cetus CLMM", transport: "grpc" as const, configured: true, pools: objects.map((object, index) => parsePool(object, poolIds[index])) };
  });
}
