import { MAX_SERVICE_FEE_BPS } from "@/constants/fees";

export const BPS_DENOMINATOR = 10_000n;

export function calculateServiceFee(amountInBaseUnits: bigint, feeBps: number) {
  if (amountInBaseUnits <= 0n) throw new Error("Swap amount must be positive.");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > MAX_SERVICE_FEE_BPS) throw new Error("Invalid service fee basis points.");
  const fee = (amountInBaseUnits * BigInt(feeBps)) / BPS_DENOMINATOR;
  const net = amountInBaseUnits - fee;
  if (net <= 0n) throw new Error("Swap amount is too small after service fee.");
  return { grossAmountIn: amountInBaseUnits, serviceFeeAmount: fee, netSwapAmount: net, feeBps };
}

export function decimalToBaseUnits(value: string | number, decimals: number): bigint {
  const text = typeof value === "number" ? String(value) : value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error("Invalid decimal amount.");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new Error(`Amount has more than ${decimals} decimal places.`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}

export function baseUnitsToDecimalString(value: bigint, decimals: number, options: { trimTrailingZeros?: boolean } = {}): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error("Invalid token decimals.");
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  if (decimals === 0) return `${negative ? "-" : ""}${absolute.toString()}`;

  const scale = 10n ** BigInt(decimals);
  const whole = absolute / scale;
  let fraction = (absolute % scale).toString().padStart(decimals, "0");
  if (options.trimTrailingZeros !== false) fraction = fraction.replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return fraction ? `${sign}${whole.toString()}.${fraction}` : `${sign}${whole.toString()}`;
}

/**
 * Numeric conversion is presentation-only. Blockchain accounting must use bigint
 * base units or baseUnitsToDecimalString() to avoid IEEE-754 precision loss.
 */
export function baseUnitsToDecimal(value: bigint, decimals: number): number {
  const text = baseUnitsToDecimalString(value, decimals);
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error("Token amount is too large for numeric presentation.");
  return number;
}


/** Presentation-only ratio derived from exact base units without converting either token amount to Number first. */
export function baseUnitRatioToNumber(input: {
  numeratorBaseUnits: bigint;
  numeratorDecimals: number;
  denominatorBaseUnits: bigint;
  denominatorDecimals: number;
  precision?: number;
}) {
  if (input.denominatorBaseUnits <= 0n || input.numeratorBaseUnits < 0n) return 0;
  const precision = Math.max(0, Math.min(12, input.precision ?? 8));
  const scale = 10n ** BigInt(precision);
  const numeratorScale = 10n ** BigInt(input.denominatorDecimals);
  const denominatorScale = 10n ** BigInt(input.numeratorDecimals);
  const scaled = input.numeratorBaseUnits * numeratorScale * scale / (input.denominatorBaseUnits * denominatorScale);
  const whole = scaled / scale;
  const fraction = (scaled % scale).toString().padStart(precision, "0").replace(/0+$/, "");
  const text = fraction ? `${whole}.${fraction}` : whole.toString();
  const value = Number(text);
  return Number.isFinite(value) ? value : 0;
}
