import "server-only";
import { getServerConfig } from "@/config/env";
import { AppError } from "@/utils/errors";

export type DeepBookStatus = {
  enabled: boolean;
  executable: false;
  network: "mainnet" | "testnet" | "devnet";
  pools: readonly string[];
  reason?: string;
};

/**
 * DeepBook is kept behind an explicit capability boundary. We do not fabricate
 * order-book quotes or PTBs: execution is disabled until the audited DeepBook
 * SDK adapter is wired for the configured pool IDs.
 */
export function getDeepBookStatus(): DeepBookStatus {
  const config = getServerConfig();
  if (!config.deepBookEnabled) {
    return { enabled: false, executable: false, network: config.network, pools: config.deepBookPoolIds, reason: "DeepBook integration is disabled." };
  }
  if (config.network === "devnet") {
    return { enabled: true, executable: false, network: config.network, pools: config.deepBookPoolIds, reason: "DeepBook execution is not enabled on Devnet." };
  }
  if (!config.deepBookPoolIds.length) {
    return { enabled: true, executable: false, network: config.network, pools: config.deepBookPoolIds, reason: "No audited DeepBook pool IDs are configured." };
  }
  return { enabled: true, executable: false, network: config.network, pools: config.deepBookPoolIds, reason: "DeepBook pool discovery is configured; transaction execution requires the audited SDK adapter." };
}

export function requireDeepBookExecution(): never {
  const status = getDeepBookStatus();
  throw new AppError("CONFIGURATION_ERROR", status.reason ?? "DeepBook execution is not configured.");
}
