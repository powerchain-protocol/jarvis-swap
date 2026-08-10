export type UnknownRecord = Record<string, unknown>;

export type TransactionEnvelope = {
  digest?: string;
  checkpoint?: string;
  timestampMs?: number;
  success: boolean;
  failureMessage?: string;
  gasUsedMist: bigint;
  computationCostMist: bigint;
  storageCostMist: bigint;
  storageRebateMist: bigint;
  nonRefundableStorageFeeMist: bigint;
  raw: UnknownRecord;
};

function record(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : undefined;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return undefined;
}

function bigintValue(value: unknown): bigint {
  try { return BigInt(String(value ?? 0)); } catch { return 0n; }
}

function message(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  const obj = record(value);
  return obj ? stringValue(obj.message ?? obj.error) : undefined;
}

export function parseTransactionEnvelope(input: unknown): TransactionEnvelope {
  const outer = record(input) ?? {};
  const failed = record(outer.FailedTransaction);
  const succeeded = record(outer.Transaction);
  const tx = succeeded ?? failed ?? outer;
  const effects = record(tx.effects) ?? {};
  const status = record(tx.status) ?? record(effects.status) ?? {};
  const gas = record(effects.gasUsed) ?? record(effects.gas_used) ?? {};

  const computationCostMist = bigintValue(gas.computationCost ?? gas.computation_cost);
  const storageCostMist = bigintValue(gas.storageCost ?? gas.storage_cost);
  const storageRebateMist = bigintValue(gas.storageRebate ?? gas.storage_rebate);
  const nonRefundableStorageFeeMist = bigintValue(gas.nonRefundableStorageFee ?? gas.non_refundable_storage_fee);
  const gasUsedMist = computationCostMist + storageCostMist + nonRefundableStorageFeeMist - storageRebateMist;

  const explicitSuccess = status.success;
  const failureMessage = message(status.error) ?? message(record(failed?.status)?.error);
  const success = !failed && explicitSuccess !== false && !failureMessage;
  const timestamp = Number(tx.timestamp ?? tx.timestampMs);

  return {
    digest: stringValue(tx.digest ?? outer.digest),
    checkpoint: stringValue(tx.checkpoint),
    timestampMs: Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined,
    success,
    failureMessage,
    gasUsedMist: gasUsedMist > 0n ? gasUsedMist : 0n,
    computationCostMist,
    storageCostMist,
    storageRebateMist,
    nonRefundableStorageFeeMist,
    raw: tx,
  };
}
