import "server-only";

import { AppError } from "@/utils/errors";

type Waiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type BudgetState = {
  active: number;
  queue: Waiter[];
};

const budgets = new Map<string, BudgetState>();

function stateFor(scope: string) {
  let state = budgets.get(scope);
  if (!state) {
    state = { active: 0, queue: [] };
    budgets.set(scope, state);
  }
  return state;
}

function unavailable(message: string, retryAfter = 1) {
  return new AppError("UPSTREAM_ERROR", message, {
    status: 503,
    expose: true,
    details: { retryAfter },
  });
}

function release(scope: string, concurrency: number) {
  const state = budgets.get(scope);
  if (!state) return;
  state.active = Math.max(0, state.active - 1);

  while (state.active < concurrency && state.queue.length) {
    const waiter = state.queue.shift();
    if (!waiter) break;
    clearTimeout(waiter.timer);
    state.active += 1;
    waiter.resolve();
  }

  if (state.active === 0 && state.queue.length === 0) budgets.delete(scope);
}

async function acquire(scope: string, concurrency: number, queueLimit: number, waitMs: number) {
  if (!/^[a-z0-9:_-]{1,64}$/i.test(scope)) throw new AppError("CONFIGURATION_ERROR", "Invalid concurrency scope.");
  if (!Number.isInteger(concurrency) || concurrency < 1 || !Number.isInteger(queueLimit) || queueLimit < 0 || !Number.isInteger(waitMs) || waitMs < 100) {
    throw new AppError("CONFIGURATION_ERROR", "Invalid concurrency budget configuration.");
  }

  const state = stateFor(scope);
  if (state.active < concurrency) {
    state.active += 1;
    return;
  }
  if (state.queue.length >= queueLimit) {
    throw unavailable("Server is at capacity. Retry shortly.");
  }

  await new Promise<void>((resolve, reject) => {
    const waiter: Waiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        const index = state.queue.indexOf(waiter);
        if (index >= 0) state.queue.splice(index, 1);
        reject(unavailable("Server is busy. Retry shortly."));
        if (state.active === 0 && state.queue.length === 0) budgets.delete(scope);
      }, waitMs),
    };
    state.queue.push(waiter);
  });
}

/**
 * Per-runtime admission control for expensive upstream work. This complements
 * distributed rate limiting: it bounds concurrent RPC/provider fan-out inside
 * one application instance and uses a small FIFO queue for short bursts.
 */
export async function withConcurrencyBudget<T>(
  scope: string,
  options: { concurrency: number; queueLimit: number; waitMs: number },
  work: () => Promise<T>,
): Promise<T> {
  await acquire(scope, options.concurrency, options.queueLimit, options.waitMs);
  try {
    return await work();
  } finally {
    release(scope, options.concurrency);
  }
}

export function concurrencySnapshot(scope: string) {
  const state = budgets.get(scope);
  return { active: state?.active ?? 0, queued: state?.queue.length ?? 0 };
}
