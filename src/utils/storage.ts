"use client";

const DEFAULT_MAX_CHARS = 64 * 1024;
const DEFAULT_MAX_STRING_CHARS = 512;

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readStorageString(key: string, maxChars = DEFAULT_MAX_STRING_CHARS): string | null {
  if (!hasStorage()) return null;
  try {
    const value = window.localStorage.getItem(key);
    if (value == null || value.length === 0 || value.length > maxChars) return null;
    return value;
  } catch {
    return null;
  }
}

export function writeStorageString(key: string, value: string, maxChars = DEFAULT_MAX_STRING_CHARS): boolean {
  if (!hasStorage() || value.length === 0 || value.length > maxChars) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readStorageJson<T>(key: string, fallback: T, validate: (value: unknown) => T | null, maxChars = DEFAULT_MAX_CHARS): T {
  const raw = readStorageString(key, maxChars);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorageJson(key: string, value: unknown, maxChars = DEFAULT_MAX_CHARS): boolean {
  try {
    const json = JSON.stringify(value);
    return writeStorageString(key, json, maxChars);
  } catch {
    return false;
  }
}
