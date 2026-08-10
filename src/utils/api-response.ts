import { NextResponse } from "next/server";
import { AppError, publicError } from "@/utils/errors";
import { rateLimitHeaders, type RateLimitResult } from "@/services/security/rate-limit";

export const NO_STORE_HEADERS = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export function jsonNoStore<T>(body: T, init: { status?: number; headers?: HeadersInit } = {}) {
  return NextResponse.json(body, {
    status: init.status,
    headers: { ...NO_STORE_HEADERS, ...Object.fromEntries(new Headers(init.headers).entries()) },
  });
}

export function apiErrorResponse(cause: unknown, fallback?: string, limit?: RateLimitResult) {
  const normalized = cause instanceof AppError
    ? cause
    : fallback
      ? new AppError("INTERNAL_ERROR", fallback, { cause })
      : undefined;
  const response = publicError(normalized ?? cause);
  const details = normalized?.details ?? (cause instanceof AppError ? cause.details : undefined);
  const retryAfter = typeof details?.retryAfter === "number" ? Math.max(1, Math.ceil(details.retryAfter)) : undefined;

  return jsonNoStore(response.body, {
    status: response.status,
    headers: {
      ...(retryAfter ? { "retry-after": String(retryAfter) } : {}),
      ...(limit ? rateLimitHeaders(limit) : {}),
    },
  });
}

export function badRequest(message: string, status = 400) {
  return jsonNoStore({ ok: false, error: { code: "BAD_REQUEST", message } }, { status });
}
