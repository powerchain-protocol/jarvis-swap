import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { databasePersistenceEnabled } from "@/services/database/persistence";
import { getServerConfig } from "@/config/env";
import { AppError } from "@/utils/errors";

type Entry = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Entry>();
let lastPruneAt = 0;

function clientIdentity(request: NextRequest) {
  // Vercel sanitizes x-forwarded-for. Hash before persistence so the rate-limit
  // table never becomes a long-lived raw-IP log.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const raw = forwarded || request.headers.get("x-real-ip") || "anonymous";
  return createHash("sha256").update(raw.slice(0, 128)).digest("hex").slice(0, 32);
}

function prune(now: number) {
  if (now - lastPruneAt < 60_000) return;
  lastPruneAt = now;
  for (const [key, value] of memoryBuckets) if (value.resetAt <= now) memoryBuckets.delete(key);
}

function rateLimited(resetAt: number, now: number, limit: number, windowMs: number): never {
  const retryAfter = Math.max(1, Math.ceil((resetAt - now) / 1000));
  throw new AppError("RATE_LIMITED", "Rate limit exceeded.", {
    details: { retryAfter, limit, remaining: 0, resetAt, windowMs },
  });
}

export type RateLimitResult = { limit: number; remaining: number; resetAt: number; windowMs: number };

export async function enforceRateLimit(
  request: NextRequest,
  scope: string,
  limit = 60,
  windowMs?: number,
): Promise<RateLimitResult> {
  const effectiveWindowMs = windowMs ?? getServerConfig().apiRateLimitWindowMs;
  if (!/^[a-z0-9:_-]{1,64}$/i.test(scope)) throw new AppError("CONFIGURATION_ERROR", "Invalid rate-limit scope.");
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(effectiveWindowMs) || effectiveWindowMs < 1_000) {
    throw new AppError("CONFIGURATION_ERROR", "Invalid rate-limit configuration.");
  }

  const now = Date.now();
  prune(now);
  const key = `${scope}:${clientIdentity(request)}`;

  if (databasePersistenceEnabled()) {
    try {
      const { getPrisma } = await import("@db/prisma/client");
      const db = getPrisma();
      const bucket = new Date(Math.floor(now / effectiveWindowMs) * effectiveWindowMs);
      const resetAt = bucket.getTime() + effectiveWindowMs;
      const row = await db.apiRateLimit.upsert({
        where: { key_bucketStart: { key, bucketStart: bucket } },
        create: { key, bucketStart: bucket, count: 1, expiresAt: new Date(resetAt + effectiveWindowMs) },
        update: { count: { increment: 1 } },
      });
      if (row.count > limit) rateLimited(resetAt, now, limit, effectiveWindowMs);
      return { limit, remaining: Math.max(0, limit - row.count), resetAt, windowMs: effectiveWindowMs };
    } catch (cause) {
      if (cause instanceof AppError && cause.code === "RATE_LIMITED") throw cause;
      // Persistence failure must not disable abuse protection; fall through to
      // the bounded process-local limiter.
    }
  }

  const old = memoryBuckets.get(key);
  const row = !old || old.resetAt <= now
    ? { count: 1, resetAt: now + effectiveWindowMs }
    : { count: old.count + 1, resetAt: old.resetAt };
  memoryBuckets.set(key, row);
  if (row.count > limit) rateLimited(row.resetAt, now, limit, effectiveWindowMs);
  return { limit, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt, windowMs: effectiveWindowMs };
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "ratelimit-limit": String(result.limit),
    "ratelimit-remaining": String(result.remaining),
    "ratelimit-reset": String(Math.ceil(result.resetAt / 1000)),
    "ratelimit-policy": `${result.limit};w=${Math.max(1, Math.ceil(result.windowMs / 1000))}`,
  };
}
