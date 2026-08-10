import { AppError } from "./errors";

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/;

function normalizeBase64(value: string) {
  if (BASE64_RE.test(value)) return value;
  if (!BASE64URL_RE.test(value)) throw new AppError("BAD_REQUEST", "Invalid base64 encoding.");
  const standard = value.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/g, "");
  const padding = standard.length % 4;
  return standard + (padding === 0 ? "" : "=".repeat(4 - padding));
}

/** Decode bounded base64/base64url without Node's permissive garbage skipping. */
export function decodeBase64Strict(value: unknown, options: { minBytes?: number; maxBytes: number; label?: string }) {
  const label = options.label ?? "payload";
  if (typeof value !== "string") throw new AppError("BAD_REQUEST", `Invalid ${label}.`);
  const input = value.trim();
  if (!input || /\s/.test(input)) throw new AppError("BAD_REQUEST", `Invalid ${label}.`);

  // Base64 expands by ~4/3. Reject obviously oversized strings before decoding.
  const maxEncoded = Math.ceil(options.maxBytes / 3) * 4 + 4;
  if (input.length > maxEncoded) throw new AppError("BAD_REQUEST", `${label} exceeds the allowed size.`);

  const normalized = normalizeBase64(input);
  const bytes = Uint8Array.from(Buffer.from(normalized, "base64"));
  const minBytes = options.minBytes ?? 1;
  if (bytes.length < minBytes || bytes.length > options.maxBytes) {
    throw new AppError("BAD_REQUEST", `Invalid ${label} size.`);
  }

  // Canonical round-trip check prevents permissive decoder edge cases.
  const canonicalInput = normalized.replace(/=+$/g, "");
  const canonicalDecoded = Buffer.from(bytes).toString("base64").replace(/=+$/g, "");
  if (canonicalInput !== canonicalDecoded) throw new AppError("BAD_REQUEST", `Invalid ${label}.`);
  return bytes;
}

export function assertEncodedSignature(value: unknown, maxChars = 4_096) {
  if (typeof value !== "string") throw new AppError("BAD_REQUEST", "Invalid Sui transaction signature.");
  const signature = value.trim();
  if (signature.length < 16 || signature.length > maxChars || /\s/.test(signature)) {
    throw new AppError("BAD_REQUEST", "Invalid Sui transaction signature.");
  }
  // Wallet-standard Sui signatures are base64 encoded. Validate syntax without
  // assuming a fixed byte length because multisig/zkLogin schemes can differ.
  normalizeBase64(signature);
  return signature;
}
