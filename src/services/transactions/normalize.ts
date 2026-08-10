import "server-only";
import type { NormalizedBalanceChange, NormalizedChainEvent, NormalizedTransaction } from "@/types/transactions";
import { parseTransactionEnvelope, type UnknownRecord } from "@/services/transactions/envelope";

function record(value: unknown): UnknownRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : undefined;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "bigint" || typeof value === "number") return String(value);
  return undefined;
}

function ownerAddress(owner: unknown): string | undefined {
  if (typeof owner === "string") return owner;
  const value = record(owner);
  return value ? stringValue(value.address ?? value.AddressOwner ?? value.owner ?? value.value) : undefined;
}

export function normalizeBalanceChanges(changes: unknown): NormalizedBalanceChange[] {
  if (!Array.isArray(changes)) return [];
  return changes.flatMap((entry) => {
    const value = record(entry);
    if (!value) return [];
    const amount = stringValue(value.amount ?? value.amountBaseUnits ?? value.balanceChange);
    const coinType = stringValue(value.coinType ?? value.coin_type);
    if (!amount || !coinType) return [];
    let direction: NormalizedBalanceChange["direction"] = "flat";
    try { const n = BigInt(amount); direction = n > 0n ? "in" : n < 0n ? "out" : "flat"; } catch {}
    return [{ owner: ownerAddress(value.owner), coinType, amountBaseUnits: amount, direction }];
  });
}

export function normalizeEvents(events: unknown, digest: string): NormalizedChainEvent[] {
  if (!Array.isArray(events)) return [];
  return events.map((event, index) => {
    const value = record(event) ?? {};
    const eventIndex = Number(value.eventIndex ?? value.event_index ?? index);
    const txDigest = stringValue(value.transactionDigest ?? value.transaction_digest) ?? digest;
    return {
      id: `${txDigest}:${Number.isInteger(eventIndex) ? eventIndex : index}`,
      transactionDigest: txDigest,
      eventIndex: Number.isInteger(eventIndex) ? eventIndex : index,
      eventType: stringValue(value.eventType ?? value.type),
      checkpoint: stringValue(value.checkpoint),
      json: value.json ?? value.parsedJson ?? value.parsed_json,
    };
  });
}

export function normalizeTransactionEntry(entry: unknown): NormalizedTransaction {
  const parsed = parseTransactionEnvelope(entry);
  const tx = parsed.raw;
  const transaction = record(tx.transaction);
  return {
    digest: parsed.digest ?? "",
    status: parsed.success ? "success" : "failure",
    checkpoint: parsed.checkpoint,
    timestampMs: parsed.timestampMs,
    sender: stringValue(transaction?.sender ?? tx.sender),
    gasUsedMist: parsed.gasUsedMist > 0n ? parsed.gasUsedMist.toString() : undefined,
    error: parsed.success ? undefined : parsed.failureMessage,
    balanceChanges: normalizeBalanceChanges(tx.balanceChanges),
    events: normalizeEvents(tx.events, parsed.digest ?? ""),
  };
}
