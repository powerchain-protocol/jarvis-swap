import "server-only";

import type { ReturnTypeOfServerConfig } from "@/types/server-config";
import { AppError } from "@/utils/errors";

export type SwapOperationsState = {
  enabled: boolean;
  reason?: string;
};

/**
 * Operator-controlled kill switch for all swap-only mutation/quote paths.
 *
 * Send/Receive and read-only portfolio/RPC surfaces remain available so an
 * operator can disable trading without taking the whole application offline.
 */
export function getSwapOperationsState(config: ReturnTypeOfServerConfig): SwapOperationsState {
  if (!config.swapOperationsEnabled) {
    return { enabled: false, reason: "Swap operations are temporarily disabled by the operator." };
  }
  if (config.network === "devnet") {
    return { enabled: false, reason: "Cetus swap execution is disabled on Devnet." };
  }
  return { enabled: true };
}

export function assertSwapOperationsEnabled(config: ReturnTypeOfServerConfig) {
  const state = getSwapOperationsState(config);
  if (!state.enabled) {
    throw new AppError("SERVICE_UNAVAILABLE", state.reason ?? "Swap operations are temporarily unavailable.", {
      status: 503,
      expose: true,
      details: { retryAfter: 30 },
    });
  }
  return state;
}
