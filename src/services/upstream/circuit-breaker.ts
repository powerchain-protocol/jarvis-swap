import "server-only";

import { AppError } from "@/utils/errors";

type CircuitState = {
  failures: number;
  openedUntil: number;
  halfOpenProbe: boolean;
  lastFailureAt?: number;
  lastSuccessAt?: number;
};

const states = new Map<string, CircuitState>();

export type CircuitBreakerOptions = {
  failureThreshold?: number;
  cooldownMs?: number;
  shouldCountFailure?: (cause: unknown) => boolean;
};

export type CircuitBreakerSnapshot = {
  key: string;
  state: "closed" | "open" | "half-open";
  failures: number;
  retryAfterSeconds?: number;
  lastFailureAt?: number;
  lastSuccessAt?: number;
};

function stateFor(key: string): CircuitState {
  const existing = states.get(key);
  if (existing) return existing;
  const created = { failures: 0, openedUntil: 0, halfOpenProbe: false };
  states.set(key, created);
  return created;
}

/**
 * Only availability failures should trip an upstream circuit. Client/configuration
 * errors are deterministic and must not poison a provider for unrelated users.
 */
export function isRetryableUpstreamFailure(cause: unknown): boolean {
  if (cause instanceof AppError) {
    if (["BAD_REQUEST", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "CONFIGURATION_ERROR"].includes(cause.code)) return false;
    return cause.status === 429 || cause.status >= 500;
  }
  if (cause instanceof DOMException && cause.name === "AbortError") return true;
  if (cause instanceof Error) {
    const message = cause.message.toLowerCase();
    const httpStatus = /\bhttp\s+(\d{3})\b/.exec(message);
    if (httpStatus) {
      const status = Number(httpStatus[1]);
      return status === 408 || status === 425 || status === 429 || status >= 500;
    }
    if (message.includes("not configured") || message.includes("unsupported") || message.includes("invalid request")) return false;
    if (message.includes("timeout") || message.includes("timed out") || message.includes("fetch failed") || message.includes("network")) return true;
    // Provider payload/schema errors can indicate an upstream regression and are
    // retryable at provider level; they should not permanently fail the process.
    return true;
  }
  return true;
}

function openError(key: string, openedUntil: number, now = Date.now()) {
  return new AppError("UPSTREAM_ERROR", `${key} is temporarily unavailable.`, {
    status: 503,
    expose: true,
    details: { retryAfter: Math.max(1, Math.ceil((openedUntil - now) / 1000)) },
  });
}

export async function withCircuitBreaker<T>(
  key: string,
  operation: () => Promise<T>,
  options: CircuitBreakerOptions = {},
): Promise<T> {
  if (!/^[a-z0-9:_-]{1,64}$/i.test(key)) throw new AppError("CONFIGURATION_ERROR", "Invalid circuit-breaker key.");
  const failureThreshold = options.failureThreshold ?? 4;
  const cooldownMs = options.cooldownMs ?? 15_000;
  const shouldCountFailure = options.shouldCountFailure ?? isRetryableUpstreamFailure;
  if (!Number.isInteger(failureThreshold) || failureThreshold < 1 || failureThreshold > 100) throw new AppError("CONFIGURATION_ERROR", "Invalid circuit-breaker failure threshold.");
  if (!Number.isInteger(cooldownMs) || cooldownMs < 100 || cooldownMs > 3_600_000) throw new AppError("CONFIGURATION_ERROR", "Invalid circuit-breaker cooldown.");

  const state = stateFor(key);
  const now = Date.now();

  if (state.openedUntil > now) throw openError(key, state.openedUntil, now);

  if (state.openedUntil !== 0 && state.openedUntil <= now) {
    if (state.halfOpenProbe) {
      throw new AppError("UPSTREAM_ERROR", `${key} recovery check is already in progress.`, {
        status: 503,
        expose: true,
        details: { retryAfter: 1 },
      });
    }
    state.halfOpenProbe = true;
  }

  try {
    const value = await operation();
    state.failures = 0;
    state.openedUntil = 0;
    state.halfOpenProbe = false;
    state.lastSuccessAt = Date.now();
    return value;
  } catch (cause) {
    state.halfOpenProbe = false;
    if (shouldCountFailure(cause)) {
      state.failures += 1;
      state.lastFailureAt = Date.now();
      if (state.failures >= failureThreshold) state.openedUntil = Date.now() + cooldownMs;
    }
    throw cause;
  }
}

export function circuitBreakerSnapshot(keys?: readonly string[]): CircuitBreakerSnapshot[] {
  const now = Date.now();
  const selected = keys ? [...new Set(keys)] : [...states.keys()];
  return selected.map((key) => {
    const state = states.get(key);
    if (!state) return { key, state: "closed" as const, failures: 0 };
    const open = state.openedUntil > now;
    const halfOpen = !open && state.openedUntil !== 0;
    return {
      key,
      state: open ? "open" : halfOpen ? "half-open" : "closed",
      failures: state.failures,
      ...(open ? { retryAfterSeconds: Math.max(1, Math.ceil((state.openedUntil - now) / 1000)) } : {}),
      ...(state.lastFailureAt ? { lastFailureAt: state.lastFailureAt } : {}),
      ...(state.lastSuccessAt ? { lastSuccessAt: state.lastSuccessAt } : {}),
    };
  });
}

export function resetCircuitBreaker(key?: string) {
  if (key) states.delete(key);
  else states.clear();
}
