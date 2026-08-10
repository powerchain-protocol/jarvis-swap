import "server-only";
import { getServerConfig } from "@/config/env";
import { listOwnedObjectsGrpc } from "@/services/sui/grpc";
import { asRecord, asSafeInteger, moveString, pickField, unwrapMoveValue, type NormalizedSuiObject } from "@/services/sui/object-shapes";
import type { PoolPosition, PoolRangeState } from "@/types/pools";

function rewardValues(fields: Record<string, unknown> | undefined): string[] {
  const raw = unwrapMoveValue(pickField(fields, ["reward_owed", "rewards_owed", "rewardOwed", "reward_amount_owed"]));
  if (!Array.isArray(raw)) return [];
  return raw.map(moveString).filter((value): value is string => Boolean(value));
}

export function classifyRange(currentTick: number | null | undefined, lower: number | null | undefined, upper: number | null | undefined): PoolRangeState {
  if (currentTick == null || lower == null || upper == null) return "unknown";
  if (currentTick < lower) return "below-range";
  if (currentTick >= upper) return "above-range";
  return "in-range";
}

export function parseCetusPositionObject(object: NormalizedSuiObject, currentTickIndex?: number | null): PoolPosition {
  const json = object.json;
  const root = asRecord(unwrapMoveValue(json));
  const fields = asRecord(unwrapMoveValue(pickField(root, ["fields"]))) ?? root;
  const tickLower = asSafeInteger(moveString(pickField(fields, ["tick_lower_index", "tick_lower", "tickLowerIndex", "tickLower"])));
  const tickUpper = asSafeInteger(moveString(pickField(fields, ["tick_upper_index", "tick_upper", "tickUpperIndex", "tickUpper"])));
  return {
    objectId: object.objectId || moveString(pickField(fields, ["id"])) || "",
    version: object.version != null ? String(object.version) : null,
    type: object.type,
    poolObjectId: moveString(pickField(fields, ["pool", "pool_id", "poolId", "pool_object_id"])),
    tickLower,
    tickUpper,
    liquidity: moveString(pickField(fields, ["liquidity"])),
    feeOwedA: moveString(pickField(fields, ["fee_owed_a", "feeOwedA", "fee_amount_owed_a"])),
    feeOwedB: moveString(pickField(fields, ["fee_owed_b", "feeOwedB", "fee_amount_owed_b"])),
    rewardOwed: rewardValues(fields),
    currentTickIndex: currentTickIndex ?? null,
    rangeState: classifyRange(currentTickIndex, tickLower, tickUpper),
    lastTransaction: object.previousTransaction,
    raw: json,
  };
}

export async function fetchCetusPositions(owner: string, currentTicks: Map<string, number | null> = new Map()) {
  const config = getServerConfig();
  if (!config.cetusPositionObjectType) return { configured: false as const, positions: [], cursor: null, hasNextPage: false };
  const result = await listOwnedObjectsGrpc(owner, config.cetusPositionObjectType, config.cetusPositionLimit);
  return {
    configured: true as const,
    positions: result.objects.map((object) => {
      const parsed = parseCetusPositionObject(object);
      return parseCetusPositionObject(object, parsed.poolObjectId ? currentTicks.get(parsed.poolObjectId) : null);
    }),
    cursor: result.cursor,
    hasNextPage: result.hasNextPage,
  };
}
