import "server-only";
import { asRecord, moveString, pickField } from "@/services/sui/object-shapes";

/** Compatibility parser for legacy call sites that still receive a `{ data }` Sui object wrapper. */
export function parseCetusPoolObject(item: unknown, fallbackId: string) {
  const root = asRecord(item);
  const data = asRecord(root?.data);
  const content = asRecord(data?.content);
  const fields = asRecord(content?.fields);
  return {
    id: moveString(data?.objectId) ?? fallbackId,
    exists: Boolean(moveString(data?.objectId)),
    type: moveString(data?.type) ?? moveString(content?.type),
    version: moveString(data?.version),
    coinTypeA: moveString(pickField(fields, ["coin_type_a", "coinTypeA"])),
    coinTypeB: moveString(pickField(fields, ["coin_type_b", "coinTypeB"])),
    feeRate: moveString(pickField(fields, ["fee_rate", "feeRate"])),
    currentSqrtPrice: moveString(pickField(fields, ["current_sqrt_price", "currentSqrtPrice"])),
    liquidity: moveString(pickField(fields, ["liquidity"])),
  };
}
