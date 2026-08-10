import "server-only";
import { createHash } from "node:crypto";
import { databasePersistenceEnabled } from "@/services/database/persistence";
import { AppError } from "@/utils/errors";

const PROCESSING_STATUS = 102;
const DEFAULT_RESULT_TTL_MS = 86_400_000;
const DEFAULT_LOCK_TTL_MS = 60_000;

type StoredResult = {
  hash: string;
  status: number;
  body: unknown;
  expires: number;
};

export type IdempotencyAcquisition =
  | { state: "acquired" }
  | { state: "replay"; status: number; body: unknown }
  | { state: "processing"; retryAfter: number };

const memory = new Map<string, StoredResult>();
let lastPruneAt = 0;

function pruneMemory(now: number) {
  if (now - lastPruneAt < 60_000) return;
  lastPruneAt = now;
  for (const [key, row] of memory) if (row.expires <= now) memory.delete(key);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "bigint") return JSON.stringify(value.toString());
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function conflict(message: string) {
  return new AppError("CONFLICT", message, { status: 409 });
}

function processing(retryAfter = 2): IdempotencyAcquisition {
  return { state: "processing", retryAfter };
}

function isUniqueConstraint(cause: unknown) {
  return Boolean(cause && typeof cause === "object" && "code" in cause && (cause as { code?: unknown }).code === "P2002");
}

export function idempotencyKey(headers: Headers) {
  const key = headers.get("idempotency-key")?.trim();
  if (!key) return undefined;
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    throw new AppError("BAD_REQUEST", "Invalid Idempotency-Key. Use 8–128 URL-safe characters.");
  }
  return key;
}

export function payloadHash(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

/**
 * Atomically reserves an idempotency key before transaction execution.
 *
 * A simple read-then-write is unsafe: concurrent requests can both observe a
 * missing key and submit the same signed transaction. Database-backed mode
 * uses the primary-key constraint as the lock. The in-memory fallback uses a
 * synchronous Map reservation for the same process.
 */
export async function acquireIdempotency(
  key: string,
  hash: string,
  options: { resultTtlMs?: number; lockTtlMs?: number } = {},
): Promise<IdempotencyAcquisition> {
  const now = Date.now();
  const resultTtlMs = options.resultTtlMs ?? DEFAULT_RESULT_TTL_MS;
  const lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
  pruneMemory(now);

  if (databasePersistenceEnabled()) {
    try {
      const { getPrisma } = await import("@db/prisma/client");
      const db = getPrisma();
      const existing = await db.apiIdempotency.findUnique({ where: { key } });

      if (existing && existing.expiresAt.getTime() <= now) {
        await db.apiIdempotency.deleteMany({ where: { key, expiresAt: { lte: new Date(now) } } });
      } else if (existing) {
        if (existing.requestHash !== hash) throw conflict("Idempotency key reused with a different request.");
        if (existing.statusCode === PROCESSING_STATUS) {
          return processing(Math.max(1, Math.ceil((existing.expiresAt.getTime() - now) / 1000)));
        }
        return { state: "replay", status: existing.statusCode, body: existing.responseBody };
      }

      try {
        await db.apiIdempotency.create({
          data: {
            key,
            requestHash: hash,
            statusCode: PROCESSING_STATUS,
            responseBody: { ok: false, status: "processing" },
            expiresAt: new Date(now + lockTtlMs),
          },
        });
        return { state: "acquired" };
      } catch (cause) {
        if (!isUniqueConstraint(cause)) throw cause;
        const raced = await db.apiIdempotency.findUnique({ where: { key } });
        if (!raced) throw cause;
        if (raced.requestHash !== hash) throw conflict("Idempotency key reused with a different request.");
        if (raced.statusCode === PROCESSING_STATUS) {
          return processing(Math.max(1, Math.ceil((raced.expiresAt.getTime() - now) / 1000)));
        }
        return { state: "replay", status: raced.statusCode, body: raced.responseBody };
      }
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      // Database failures must not turn idempotency off. Fall through to a
      // process-local reservation, which still protects a single function
      // instance while persistence is unavailable.
    }
  }

  const existing = memory.get(key);
  if (existing && existing.expires > now) {
    if (existing.hash !== hash) throw conflict("Idempotency key reused with a different request.");
    if (existing.status === PROCESSING_STATUS) {
      return processing(Math.max(1, Math.ceil((existing.expires - now) / 1000)));
    }
    return { state: "replay", status: existing.status, body: existing.body };
  }

  memory.set(key, {
    hash,
    status: PROCESSING_STATUS,
    body: { ok: false, status: "processing" },
    expires: now + lockTtlMs,
  });
  void resultTtlMs; // retained here so acquisition and completion share one API contract.
  return { state: "acquired" };
}

export async function completeIdempotency(
  key: string,
  hash: string,
  status: number,
  body: unknown,
  ttlMs = DEFAULT_RESULT_TTL_MS,
) {
  const expiresAt = new Date(Date.now() + ttlMs);
  if (databasePersistenceEnabled()) {
    try {
      const { getPrisma } = await import("@db/prisma/client");
      await getPrisma().apiIdempotency.updateMany({
        where: { key, requestHash: hash },
        data: { statusCode: status, responseBody: body as object, expiresAt },
      });
      memory.delete(key);
      return;
    } catch {
      // Fall through to memory so the response can still be replayed locally.
    }
  }
  memory.set(key, { hash, status, body, expires: expiresAt.getTime() });
}

/** Release only a still-processing reservation. Useful for validation failures
 * that happen before an RPC submission attempt and are therefore safe to retry.
 */
export async function releaseIdempotency(key: string, hash: string) {
  if (databasePersistenceEnabled()) {
    try {
      const { getPrisma } = await import("@db/prisma/client");
      await getPrisma().apiIdempotency.deleteMany({ where: { key, requestHash: hash, statusCode: PROCESSING_STATUS } });
    } catch {
      // Best-effort; the lock expires quickly even if cleanup cannot run.
    }
  }
  const row = memory.get(key);
  if (row?.hash === hash && row.status === PROCESSING_STATUS) memory.delete(key);
}
