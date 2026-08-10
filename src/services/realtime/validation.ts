import type { RealtimeEnvelope, RealtimeTopic } from "@/types/realtime";

const TOPICS = new Set<RealtimeTopic>(["prices", "wallet", "transactions", "pools", "swap", "network"]);
const NETWORKS = new Set(["mainnet", "testnet", "devnet"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseRealtimeEnvelope(value: unknown): RealtimeEnvelope | null {
  if (!isRecord(value)) return null;
  if (typeof value.type !== "string" || value.type.length < 1 || value.type.length > 96) return null;
  if (!Number.isSafeInteger(value.timestamp) || Number(value.timestamp) <= 0) return null;
  if (value.topic != null && (typeof value.topic !== "string" || !TOPICS.has(value.topic as RealtimeTopic))) return null;
  if (value.network != null && (typeof value.network !== "string" || !NETWORKS.has(value.network))) return null;
  if (value.sequence != null && (!Number.isSafeInteger(value.sequence) || Number(value.sequence) < 0)) return null;
  if (!("data" in value)) return null;
  return value as RealtimeEnvelope;
}
