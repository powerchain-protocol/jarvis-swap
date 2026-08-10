"use client";

export type PublicApiError = {
  error?: string | { code?: string; message?: string };
  message?: string;
};

export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as PublicApiError;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  if (record.error && typeof record.error === "object" && typeof record.error.message === "string" && record.error.message.trim()) {
    return record.error.message;
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return fallback;
}

export async function readApiJson<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  return response.json().catch(() => null) as Promise<T | null>;
}
