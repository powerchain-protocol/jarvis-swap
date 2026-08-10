import type { APP_VERSION } from "@/constants/release";

export type DeploymentCapability = {
  enabled: boolean;
  reason?: string;
};

export type DeploymentStatus = {
  service: "jarvis-swap";
  version: typeof APP_VERSION;
  network: "mainnet" | "testnet" | "devnet";
  cluster: "mainnet" | "testnet" | "devnet" | "custom";
  mode: "production" | "test" | "development";
  appReady: boolean;
  swapReady: boolean;
  maintenanceMode?: boolean;
  policyFingerprint: string;
  capacity: {
    quoteConcurrency: number;
    portfolioConcurrency: number;
    priceConcurrency: number;
    queueLimit: number;
    queueWaitMs: number;
    runtime: {
      quote: { active: number; queued: number };
      portfolio: { active: number; queued: number };
      prices: { active: number; queued: number };
    };
  };
  upstreams: {
    failureThreshold: number;
    cooldownMs: number;
    circuits: Array<{
      key: string;
      state: "closed" | "open" | "half-open";
      failures: number;
      retryAfterSeconds?: number;
      lastFailureAt?: number;
      lastSuccessAt?: number;
    }>;
  };
  capabilities: {
    swap: DeploymentCapability;
    send: DeploymentCapability;
    receive: DeploymentCapability;
    portfolio: DeploymentCapability;
    pools: DeploymentCapability;
    walletSessions: DeploymentCapability;
    persistence: DeploymentCapability;
  };
  blockers: string[];
  warnings: string[];
};
