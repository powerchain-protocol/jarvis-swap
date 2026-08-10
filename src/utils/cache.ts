type CacheEntry<T> = { value: T; expiresAt: number; touchedAt: number };

const memory = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_CACHE_ENTRIES = 512;
let lastPruneAt = 0;

function pruneExpired(now = Date.now()) {
  if (now - lastPruneAt < 30_000 && memory.size <= MAX_CACHE_ENTRIES) return;
  lastPruneAt = now;
  for (const [key, entry] of memory) {
    if (entry.expiresAt <= now) memory.delete(key);
  }

  if (memory.size <= MAX_CACHE_ENTRIES) return;
  const oldest = [...memory.entries()]
    .sort((a, b) => a[1].touchedAt - b[1].touchedAt)
    .slice(0, memory.size - MAX_CACHE_ENTRIES);
  for (const [key] of oldest) memory.delete(key);
}

export function readCache<T>(key: string): T | null {
  const now = Date.now();
  const entry = memory.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    memory.delete(key);
    return null;
  }
  entry.touchedAt = now;
  return entry.value;
}

export function writeCache<T>(key: string, value: T, ttlMs: number) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return value;
  const now = Date.now();
  pruneExpired(now);
  memory.set(key, { value, expiresAt: now + ttlMs, touchedAt: now });
  pruneExpired(now);
  return value;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    memory.clear();
    return;
  }
  for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key);
}

export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = readCache<T>(key);
  if (hit !== null) return hit;

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = loader()
    .then((value) => writeCache(key, value, ttlMs))
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}


export function withAbortSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener("abort", onAbort); resolve(value); },
      (cause) => { signal.removeEventListener("abort", onAbort); reject(cause); },
    );
  });
}
