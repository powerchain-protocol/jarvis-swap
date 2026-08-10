import { AppError } from "@/utils/errors";

export type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  retryUnsafeMethods?: boolean;
};

function retryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryableMethod(method: string, allowUnsafe: boolean) {
  return allowUnsafe || ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function retryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 60_000);
  const at = Date.parse(raw);
  if (!Number.isFinite(at)) return null;
  return Math.min(Math.max(0, at - Date.now()), 60_000);
}

function sleep(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function combinedSignal(parent: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const onAbort = () => controller.abort(parent?.reason ?? new DOMException("Aborted", "AbortError"));
  if (parent?.aborted) onAbort();
  else parent?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

export async function fetchJson<T>(input: RequestInfo | URL, options: FetchJsonOptions = {}): Promise<T> {
  const {
    timeoutMs = 8_000,
    retries = 1,
    retryDelayMs = 300,
    maxRetryDelayMs = 5_000,
    retryUnsafeMethods = false,
    signal: parentSignal,
    ...init
  } = options;
  const method = (init.method ?? "GET").toUpperCase();
  const canRetryMethod = retryableMethod(method, retryUnsafeMethods);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const attemptSignal = combinedSignal(parentSignal, timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: attemptSignal.signal });
      if (!response.ok) {
        const message = await response.text().catch(() => "");
        const error = new AppError("UPSTREAM_ERROR", message || `Request failed with ${response.status}.`, { status: response.status });
        if (attempt < retries && canRetryMethod && retryableStatus(response.status)) {
          const exponential = Math.min(maxRetryDelayMs, retryDelayMs * 2 ** attempt);
          await sleep(retryAfterMs(response) ?? exponential, parentSignal);
          continue;
        }
        throw error;
      }
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      const abortedByCaller = Boolean(parentSignal?.aborted);
      const isHttpError = error instanceof AppError;
      if (abortedByCaller || isHttpError || attempt >= retries || !canRetryMethod) break;
      const delay = Math.min(maxRetryDelayMs, retryDelayMs * 2 ** attempt);
      await sleep(delay, parentSignal);
    } finally {
      attemptSignal.cleanup();
    }
  }

  if (parentSignal?.aborted) throw parentSignal.reason ?? new DOMException("Aborted", "AbortError");
  throw lastError instanceof Error ? lastError : new AppError("UPSTREAM_ERROR", "Request failed.");
}
