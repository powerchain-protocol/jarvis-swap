export type RpcTransport = "grpc" | "json-rpc" | "protected-rpc";

export type RpcEndpointHealth = {
  url?: string;
  transport: RpcTransport | "unknown";
  ok: boolean;
  latencyMs?: number;
  checkpoint?: string;
  error?: string;
  checkedAt: number;
};


export type RpcReadEndpointHealth = {
  host: string;
  state: "available" | "quarantined";
  preferred?: boolean;
  successes: number;
  failures: number;
  consecutiveFailures: number;
  lastLatencyMs?: number;
  ewmaLatencyMs?: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  retryAfterMs: number;
};

export type RpcPoolHealth = {
  state: "cold" | "healthy" | "degraded" | "critical";
  endpointCount: number;
  healthyCount: number;
  quarantinedCount: number;
  observedCount: number;
  preferredHost?: string;
  preferredLatencyMs?: number;
};

export type NetworkStatus = {
  ok: boolean;
  network: "mainnet" | "testnet" | "devnet";
  cluster?: "mainnet" | "testnet" | "devnet" | "custom";
  clusterLabel?: string;
  endpointCount?: number;
  endpointLabels?: string[];
  preferredReadEndpoint?: string;
  transport?: string;
  checkpoint?: string | number;
  referenceGasPrice?: string | number;
  latencyMs?: number;
  rpcEndpointCount?: number;
  rpcHealth?: RpcReadEndpointHealth[];
  rpcPool?: RpcPoolHealth;
  chainId?: string;
  epoch?: string | number;
  checkedAt?: number;
};
