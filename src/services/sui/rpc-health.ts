import "server-only";

export type RpcEndpointHealth = {
  endpoint: string;
  successes: number;
  failures: number;
  consecutiveFailures: number;
  lastLatencyMs?: number;
  ewmaLatencyMs?: number;
  lastSuccessAt?: number;
  lastFailureAt?: number;
  openUntil?: number;
  lastError?: string;
};

const states = new Map<string, RpcEndpointHealth>();
const EWMA_ALPHA = 0.25;
export type RpcPoolHealthSummary = {
  state: "cold" | "healthy" | "degraded" | "critical";
  endpointCount: number;
  healthyCount: number;
  quarantinedCount: number;
  observedCount: number;
  preferredHost?: string;
  preferredLatencyMs?: number;
};


function stateFor(endpoint: string) {
  let state = states.get(endpoint);
  if (!state) {
    state = { endpoint, successes: 0, failures: 0, consecutiveFailures: 0 };
    states.set(endpoint, state);
  }
  return state;
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message.slice(0, 240) : "Unknown RPC failure";
}

export function isRpcEndpointAvailable(endpoint: string, now = Date.now()) {
  const state = states.get(endpoint);
  return !state?.openUntil || state.openUntil <= now;
}

export function recordRpcSuccess(endpoint: string, latencyMs: number) {
  const state = stateFor(endpoint);
  const latency = Math.max(0, Math.round(latencyMs));
  state.successes += 1;
  state.consecutiveFailures = 0;
  state.lastLatencyMs = latency;
  state.ewmaLatencyMs = state.ewmaLatencyMs == null
    ? latency
    : Math.round((state.ewmaLatencyMs * (1 - EWMA_ALPHA)) + (latency * EWMA_ALPHA));
  state.lastSuccessAt = Date.now();
  state.openUntil = undefined;
  state.lastError = undefined;
}

export function recordRpcFailure(endpoint: string, cause: unknown, threshold: number, cooldownMs: number) {
  const state = stateFor(endpoint);
  state.failures += 1;
  state.consecutiveFailures += 1;
  state.lastFailureAt = Date.now();
  state.lastError = message(cause);
  if (state.consecutiveFailures >= threshold) {
    const multiplier = Math.min(2 ** Math.max(0, state.consecutiveFailures - threshold), 8);
    state.openUntil = Date.now() + cooldownMs * multiplier;
  }
}

/**
 * Rank read endpoints using health first and configured order as a stable tie breaker.
 * Unknown endpoints keep their operator-provided priority until enough latency data exists.
 */
export function rankRpcEndpoints(endpoints: readonly string[], now = Date.now()) {
  return [...endpoints]
    .map((endpoint, configuredIndex) => {
      const state = states.get(endpoint);
      const quarantined = Boolean(state?.openUntil && state.openUntil > now);
      const latency = state?.ewmaLatencyMs ?? Number.POSITIVE_INFINITY;
      const reliabilityPenalty = (state?.consecutiveFailures ?? 0) * 10_000;
      const warmupPenalty = state?.successes ? 0 : configuredIndex * 10;
      return { endpoint, configuredIndex, quarantined, score: reliabilityPenalty + latency + warmupPenalty };
    })
    .sort((a, b) => Number(a.quarantined) - Number(b.quarantined) || a.score - b.score || a.configuredIndex - b.configuredIndex)
    .map((entry) => entry.endpoint);
}

export function preferredRpcEndpoint(endpoints: readonly string[]) {
  return rankRpcEndpoints(endpoints)[0];
}

export function rpcEndpointHealthSnapshot(endpoints: readonly string[]) {
  const now = Date.now();
  const ranked = rankRpcEndpoints(endpoints, now);
  return endpoints.map((endpoint) => {
    const state = states.get(endpoint);
    let host = "unknown";
    try { host = new URL(endpoint).host; } catch { /* validated before runtime */ }
    return {
      host,
      state: !state?.openUntil || state.openUntil <= now ? "available" : "quarantined",
      preferred: ranked[0] === endpoint,
      successes: state?.successes ?? 0,
      failures: state?.failures ?? 0,
      consecutiveFailures: state?.consecutiveFailures ?? 0,
      lastLatencyMs: state?.lastLatencyMs,
      ewmaLatencyMs: state?.ewmaLatencyMs,
      lastSuccessAt: state?.lastSuccessAt,
      lastFailureAt: state?.lastFailureAt,
      retryAfterMs: state?.openUntil && state.openUntil > now ? state.openUntil - now : 0,
    } as const;
  });
}


export function rpcPoolHealthSummary(endpoints: readonly string[]): RpcPoolHealthSummary {
  const snapshot = rpcEndpointHealthSnapshot(endpoints);
  const healthy = snapshot.filter((entry) => entry.state === "available");
  const quarantined = snapshot.filter((entry) => entry.state === "quarantined");
  const observed = snapshot.filter((entry) => entry.successes + entry.failures > 0);
  const preferred = snapshot.find((entry) => entry.preferred);
  const state: RpcPoolHealthSummary["state"] = observed.length === 0
    ? "cold"
    : healthy.length === 0
      ? "critical"
      : quarantined.length > 0 || healthy.some((entry) => entry.consecutiveFailures > 0)
        ? "degraded"
        : "healthy";
  return {
    state,
    endpointCount: snapshot.length,
    healthyCount: healthy.length,
    quarantinedCount: quarantined.length,
    observedCount: observed.length,
    preferredHost: preferred?.host,
    preferredLatencyMs: preferred?.ewmaLatencyMs ?? preferred?.lastLatencyMs,
  };
}

export function resetRpcHealthForTests() {
  states.clear();
}
