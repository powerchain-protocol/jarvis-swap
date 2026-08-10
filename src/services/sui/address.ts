const SUI_ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/;

export function normalizeSuiAddress(value: string): string {
  const trimmed = value.trim();
  if (!SUI_ADDRESS_RE.test(trimmed)) throw new Error("Invalid Sui address.");
  const body = trimmed.slice(2).toLowerCase().padStart(64, "0");
  const normalized = `0x${body}`;
  if (/^0x0{64}$/.test(normalized)) throw new Error("Zero Sui address is not allowed.");
  return normalized;
}

export function isValidSuiAddress(value: string | undefined | null): value is string {
  if (!value) return false;
  try { normalizeSuiAddress(value); return true; } catch { return false; }
}

export function assertCoinType(value: string, label = "coin type"): string {
  const parts = value.trim().split("::");
  if (parts.length !== 3 || !parts[1] || !parts[2]) throw new Error(`Invalid ${label}.`);
  const address = normalizeSuiAddress(parts[0]);
  return `${address}::${parts[1]}::${parts[2]}`;
}
