import "server-only";
import { APP_NAME, APP_VERSION } from "@/constants/release";

const REDACTED_KEYS = /(?:address|wallet|secret|token|authorization|cookie|signature|transaction|digest|coinType|rpc|url|key)/i;

type LogLevel = "info" | "warn" | "error";
type SafeField = string | number | boolean | null | undefined;

function safeValue(key: string, value: unknown): SafeField {
  if (REDACTED_KEYS.test(key)) return "[redacted]";
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return typeof value === "string" ? value.slice(0, 512) : value;
  }
  return "[unsupported]";
}

function errorClass(cause: unknown) {
  return cause instanceof Error ? cause.name.slice(0, 80) : "UnknownError";
}

export function requestCorrelationId(request: Request) {
  const candidate = request.headers.get("x-request-id")?.trim();
  return candidate && /^[A-Za-z0-9._:-]{8,128}$/.test(candidate) ? candidate : "missing";
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
  cause?: unknown,
) {
  const record: Record<string, SafeField> = {
    ts: new Date().toISOString(),
    level,
    service: APP_NAME,
    event: event.replace(/[^a-z0-9._:-]/gi, "_").slice(0, 96),
    version: APP_VERSION,
  };
  for (const [key, value] of Object.entries(fields)) record[key] = safeValue(key, value);
  if (cause !== undefined) record.errorClass = errorClass(cause);

  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
