export type RealtimeState = "idle" | "connecting" | "open" | "reconnecting" | "closed" | "error";

export type RealtimeTopic = "prices" | "wallet" | "transactions" | "pools" | "swap" | "network";

export type RealtimeEnvelope<T = unknown> = {
  type: string;
  topic?: RealtimeTopic;
  network?: "mainnet" | "testnet" | "devnet";
  sequence?: number;
  timestamp: number;
  data: T;
};

export type RealtimeConnectionInfo = {
  state: RealtimeState;
  attempts: number;
  lastConnectedAt: number | null;
  lastMessageAt: number | null;
  error: string | null;
};
