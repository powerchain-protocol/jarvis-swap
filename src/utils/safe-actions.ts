import { AppError, publicError, toAppError } from "./errors";

export type ActionSuccess<T> = { ok: true; data: T };
export type ActionFailure = { ok: false; error: ReturnType<typeof publicError> };
export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

export async function safeAction<T>(run: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (cause) {
    return { ok: false, error: publicError(toAppError(cause)) };
  }
}

export function requireAction(condition: unknown, message: string, code: ConstructorParameters<typeof AppError>[0] = "BAD_REQUEST"): asserts condition {
  if (!condition) throw new AppError(code, message);
}

export async function readJson<T>(request: Request, maxBytes = 32_768): Promise<T> {
  const contentType = request.headers.get("content-type");
  if (contentType && !/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new AppError("BAD_REQUEST", "Content-Type must be application/json.");
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(length) && length > maxBytes) throw new AppError("BAD_REQUEST", "Request body is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new AppError("BAD_REQUEST", "Request body is too large.");
  try { return JSON.parse(text) as T; } catch { throw new AppError("BAD_REQUEST", "Invalid JSON request body."); }
}
