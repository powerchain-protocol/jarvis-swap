export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "DATABASE_ERROR"
  | "CONFIGURATION_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400, UNAUTHORIZED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409,
  RATE_LIMITED: 429, UPSTREAM_ERROR: 502, DATABASE_ERROR: 503, CONFIGURATION_ERROR: 500, SERVICE_UNAVAILABLE: 503, INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly expose: boolean;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, options: { status?: number; expose?: boolean; cause?: unknown; details?: Record<string, unknown> } = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? STATUS_BY_CODE[code];
    this.expose = options.expose ?? this.status < 500;
    this.details = options.details;
  }
}

export function toAppError(cause: unknown, fallback = "Unexpected server error.") {
  if (cause instanceof AppError) return cause;
  if (cause instanceof Error) return new AppError("INTERNAL_ERROR", fallback, { cause });
  return new AppError("INTERNAL_ERROR", fallback);
}

export function publicError(cause: unknown) {
  const error = toAppError(cause);
  return {
    status: error.status,
    body: { ok: false as const, error: { code: error.code, message: error.expose ? error.message : "Internal server error." } },
  };
}
