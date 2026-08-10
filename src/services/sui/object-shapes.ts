/**
 * Runtime-safe helpers for Sui gRPC/Core object responses.
 *
 * SDK response shapes can evolve between minor releases and upstream JSON fields
 * are chain data, so server code must narrow `unknown` before consuming values.
 */
export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;
}

export function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "bigint") return value.toString();
  return null;
}

export function asSafeInteger(value: unknown): number | null {
  const text = asString(value);
  if (text === null || !/^-?\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function pickField(record: UnknownRecord | undefined, names: readonly string[]): unknown {
  if (!record) return undefined;
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) return record[name];
  }
  return undefined;
}

export function unwrapMoveValue(value: unknown, maxDepth = 6): unknown {
  let current = value;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    const record = asRecord(current);
    if (!record) return current;
    const fields = asRecord(record.fields);
    if (fields) {
      current = fields;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(record, "value") && Object.keys(record).length <= 3) {
      current = record.value;
      continue;
    }
    return current;
  }
  return current;
}

export function moveString(value: unknown): string | null {
  const unwrapped = unwrapMoveValue(value);
  const direct = asString(unwrapped);
  if (direct !== null) return direct;
  const record = asRecord(unwrapped);
  if (!record) return null;
  for (const candidate of [record.id, record.objectId, record.bytes, record.value, record.name]) {
    const text = asString(candidate);
    if (text !== null) return text;
  }
  return null;
}

export type NormalizedSuiObject = {
  objectId: string;
  version: string | number | bigint | null;
  digest: string | null;
  type: string | null;
  owner: unknown;
  json: unknown;
  display: unknown;
  previousTransaction: string | null;
  error?: string;
};

export function normalizeSuiObject(value: unknown, fallbackObjectId = ""): NormalizedSuiObject {
  if (value instanceof Error) {
    return {
      objectId: fallbackObjectId,
      version: null,
      digest: null,
      type: null,
      owner: null,
      json: null,
      display: null,
      previousTransaction: null,
      error: value.message,
    };
  }

  const record = asRecord(value);
  const display = asRecord(record?.display);
  return {
    objectId: asString(record?.objectId) ?? fallbackObjectId,
    version: (typeof record?.version === "string" || typeof record?.version === "number" || typeof record?.version === "bigint") ? record.version : null,
    digest: asString(record?.digest),
    type: asString(record?.type),
    owner: record?.owner ?? null,
    json: record?.json ?? null,
    display: display?.output ?? record?.display ?? null,
    previousTransaction: asString(record?.previousTransaction),
  };
}
