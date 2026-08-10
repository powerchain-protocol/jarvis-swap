import { AppError } from "@/utils/errors";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function normalizedOrigin(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

function expectedOrigins(request: Request) {
  const result = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const normalized = normalizedOrigin(appUrl);
    if (normalized) result.add(normalized);
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) result.add(`${forwardedProto || "https"}://${host}`);

  try {
    result.add(new URL(request.url).origin);
  } catch {
    // Request.url should be absolute in Next route handlers, but do not make
    // malformed URL metadata itself a reason to accept an unsafe origin.
  }
  return result;
}

/**
 * Browser-facing mutation endpoints are same-origin only. Requests without
 * browser fetch metadata/origin headers remain usable by trusted server clients,
 * while explicit cross-site browser requests fail closed.
 */
export function assertMutationRequest(request: Request) {
  const method = request.method.toUpperCase();
  if (!UNSAFE_METHODS.has(method)) return;

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite === "cross-site") {
    throw new AppError("FORBIDDEN", "Cross-site mutation requests are not accepted.");
  }

  const origin = request.headers.get("origin")?.trim();
  if (!origin || origin === "null") {
    if (origin === "null") throw new AppError("FORBIDDEN", "Opaque-origin mutation requests are not accepted.");
    return;
  }

  const normalized = normalizedOrigin(origin);
  if (!normalized || !expectedOrigins(request).has(normalized)) {
    throw new AppError("FORBIDDEN", "Request origin is not allowed.");
  }
}
