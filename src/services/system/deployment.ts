import "server-only";

import { getServerConfig } from "@/config/env";
import { databasePersistenceEnabled } from "@/services/database/persistence";
import { getSwapReadiness } from "@/services/system/readiness";
import type { DeploymentStatus } from "@/types/deployment";
import { circuitBreakerSnapshot } from "@/services/upstream/circuit-breaker";
import { concurrencySnapshot } from "@/services/security/concurrency";
import { getSwapOperationsState } from "@/services/system/operations";
import { APP_NAME, APP_VERSION } from "@/constants/release";
import { getExecutionPolicyFingerprint } from "@/services/system/policy-fingerprint";

function deploymentMode(network: "mainnet" | "testnet" | "devnet"): DeploymentStatus["mode"] {
  if (network === "mainnet") return "production";
  if (network === "testnet") return "test";
  return "development";
}

/**
 * Public, secret-free deployment capability summary.
 *
 * Devnet intentionally remains application-ready even though Cetus swapping is
 * disabled there. This lets wallet connection, Send/Receive, RPC diagnostics,
 * token metadata and portfolio development run without making /ready fail.
 */
export function getDeploymentStatus(): DeploymentStatus {
  const config = getServerConfig();
  const swap = getSwapReadiness();
  const operations = getSwapOperationsState(config);
  const persistenceConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const persistenceEnabled = databasePersistenceEnabled();
  const blockers: string[] = [];
  if (config.maintenanceMode) blockers.push("Deployment is in maintenance mode.");
  const warnings = [...swap.warnings];

  // Mainnet deployments default to treating swap readiness as an application
  // readiness requirement. Testnet/Devnet can remain usable for non-swap flows.
  if (config.readinessRequireSwap && !swap.executionEnabled) blockers.push(...swap.blockers);
  else if (!swap.executionEnabled) warnings.push(...swap.blockers.map((item) => `Swap disabled: ${item}`));

  if (persistenceEnabled && !persistenceConfigured) blockers.push("Database persistence is enabled but DATABASE_URL is missing.");

  return {
    service: APP_NAME,
    version: APP_VERSION,
    network: config.network,
    cluster: config.cluster,
    mode: deploymentMode(config.network),
    appReady: blockers.length === 0,
    swapReady: swap.executionEnabled && !config.maintenanceMode,
    maintenanceMode: config.maintenanceMode,
    policyFingerprint: getExecutionPolicyFingerprint(),
    capacity: {
      quoteConcurrency: config.quoteConcurrency,
      portfolioConcurrency: config.portfolioConcurrency,
      priceConcurrency: config.priceConcurrency,
      queueLimit: config.requestQueueLimit,
      queueWaitMs: config.requestQueueWaitMs,
      runtime: {
        quote: concurrencySnapshot("swap-quote-upstream"),
        portfolio: concurrencySnapshot("portfolio-upstream"),
        prices: concurrencySnapshot("prices-upstream"),
      },
    },
    upstreams: {
      failureThreshold: config.upstreamFailureThreshold,
      cooldownMs: config.upstreamCooldownMs,
      circuits: circuitBreakerSnapshot([
        "cetus-aggregator",
        "price-pyth",
        "price-birdeye",
        "price-coinmarketcap",
        "price-coingecko",
      ]),
    },
    capabilities: {
      swap: { enabled: swap.executionEnabled, reason: swap.executionEnabled ? undefined : operations.reason ?? swap.blockers[0] ?? "Swap execution is not configured." },
      send: { enabled: true },
      receive: { enabled: true },
      portfolio: { enabled: true },
      pools: { enabled: config.network !== "devnet", reason: config.network === "devnet" ? "Cetus pool integrations are not enabled on Devnet." : undefined },
      walletSessions: { enabled: config.requireWalletSession, reason: config.requireWalletSession ? undefined : "Wallet-authenticated HTTP sessions are optional in this profile." },
      persistence: { enabled: persistenceEnabled, reason: persistenceEnabled ? undefined : "Durable database persistence is disabled." },
    },
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
  };
}
