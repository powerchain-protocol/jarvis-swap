export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isBrowser() {
  return typeof window !== "undefined";
}

export function nonEmpty(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}
