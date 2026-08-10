export type NormalizedBalanceChange = {
  owner?: string; coinType: string; amountBaseUnits: string; direction: "in" | "out" | "flat";
};

export type NormalizedChainEvent = {
  id: string; transactionDigest: string; eventIndex: number; eventType?: string; checkpoint?: string; json?: unknown;
};

export type NormalizedTransaction = {
  digest: string; status: "success" | "failure"; checkpoint?: string; timestampMs?: number;
  sender?: string; gasUsedMist?: string; error?: string; balanceChanges: NormalizedBalanceChange[];
  events: NormalizedChainEvent[];
};

export type WalletActivityPage = {
  owner: string; network: "mainnet" | "testnet" | "devnet"; transactions: NormalizedTransaction[];
  startCursor: string | null; endCursor: string | null; hasNextPage: boolean;
};
