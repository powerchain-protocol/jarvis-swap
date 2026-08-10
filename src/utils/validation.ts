import { AppError } from "./errors";

export function requireInteger(value: unknown, name: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError("BAD_REQUEST", `${name} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

export function requireFiniteNumber(value: unknown, name: string, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new AppError("BAD_REQUEST", `${name} must be between ${min} and ${max}.`);
  }
  return parsed;
}

export function requireFutureTimestamp(value: unknown, name = "expiresAt", maxFutureMs = 10 * 60_000): number {
  const parsed = requireFiniteNumber(value, name, Date.now() + 1, Date.now() + maxFutureMs);
  return Math.trunc(parsed);
}
