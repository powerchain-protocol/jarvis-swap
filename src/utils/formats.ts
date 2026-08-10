const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export function formatInteger(value: number | bigint) { return integer.format(value); }
export function formatCompact(value: number) { return Number.isFinite(value) ? compact.format(value) : "—"; }
export function formatPercentRatio(value: number) { return Number.isFinite(value) ? percent.format(value) : "—"; }
export function formatBps(bps: number) { return Number.isFinite(bps) ? `${(bps / 100).toFixed(bps % 100 ? 2 : 0)}%` : "—"; }
export function formatUsd(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value > 0 && value < 0.01) return `$${value.toFixed(8)}`;
  return usd.format(value);
}
export function truncateDecimalText(value: string, decimals: number): string {
  const text = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return text;
  const precision = Math.min(Math.max(Math.trunc(decimals), 0), 255);
  const [whole, fraction = ""] = text.split(".");
  if (!precision || !fraction) return whole;
  const clipped = fraction.slice(0, precision).replace(/0+$/, "");
  return clipped ? `${whole}.${clipped}` : whole;
}

export function formatTokenAmount(value: string | number, decimals?: number) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return String(value);
    const precision = decimals == null ? (Math.abs(value) < 1 ? 8 : 4) : Math.min(Math.max(decimals, 0), 9);
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: precision }).format(value);
  }

  const text = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) return value;
  const precision = decimals == null ? 8 : Math.min(Math.max(Math.trunc(decimals), 0), 18);
  const clipped = truncateDecimalText(text, precision);
  const negative = clipped.startsWith("-");
  const unsigned = negative ? clipped.slice(1) : clipped;
  const [whole, fraction] = unsigned.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}
export function shortenAddress(value: string, left = 6, right = 4) {
  if (value.length <= left + right + 1) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}
export function formatFiatValue(value: number, currency = "USD") {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: value > 0 && value < 1 ? 6 : 2 }).format(value);
}

export function isPositiveDecimalText(value: string): boolean {
  const text = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return false;
  return /[1-9]/.test(text);
}

export function compareUnsignedDecimalText(left: string, right: string): -1 | 0 | 1 {
  const normalize = (value: string) => {
    const [rawWhole, rawFraction = ""] = value.trim().split(".");
    const whole = rawWhole.replace(/^0+(?=\d)/, "") || "0";
    const fraction = rawFraction.replace(/0+$/, "");
    return { whole, fraction };
  };
  const a = normalize(left);
  const b = normalize(right);
  if (a.whole.length !== b.whole.length) return a.whole.length < b.whole.length ? -1 : 1;
  if (a.whole !== b.whole) return a.whole < b.whole ? -1 : 1;
  const length = Math.max(a.fraction.length, b.fraction.length);
  const af = a.fraction.padEnd(length, "0");
  const bf = b.fraction.padEnd(length, "0");
  return af === bf ? 0 : af < bf ? -1 : 1;
}

export function subtractUnsignedDecimalText(left: string, right: string): string {
  const parse = (value: string) => {
    const text = value.trim();
    if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error("Invalid unsigned decimal value.");
    const [whole, fraction = ""] = text.split(".");
    return { whole: whole.replace(/^0+(?=\d)/, "") || "0", fraction };
  };
  const a = parse(left);
  const b = parse(right);
  const decimals = Math.max(a.fraction.length, b.fraction.length);
  const scale = 10n ** BigInt(decimals);
  const toUnits = (value: { whole: string; fraction: string }) =>
    BigInt(value.whole) * scale + BigInt((value.fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  const result = toUnits(a) - toUnits(b);
  if (result <= 0n) return "0";
  if (decimals === 0) return result.toString();
  const whole = result / scale;
  const fraction = (result % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}


export function scaleUnsignedDecimalText(value: string, numerator: number, denominator: number, maxDecimals = 18): string {
  const text = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error("Invalid unsigned decimal value.");
  if (!Number.isSafeInteger(numerator) || numerator < 0) throw new Error("Invalid ratio numerator.");
  if (!Number.isSafeInteger(denominator) || denominator <= 0) throw new Error("Invalid ratio denominator.");
  const [whole, rawFraction = ""] = text.split(".");
  const precision = Math.min(rawFraction.length, Math.max(0, Math.min(Math.trunc(maxDecimals), 255)));
  const scale = 10n ** BigInt(precision);
  const fraction = rawFraction.slice(0, precision).padEnd(precision, "0");
  const units = BigInt(whole || "0") * scale + BigInt(fraction || "0");
  const result = units * BigInt(numerator) / BigInt(denominator);
  if (precision === 0) return result.toString();
  const resultWhole = result / scale;
  const resultFraction = (result % scale).toString().padStart(precision, "0").replace(/0+$/, "");
  return resultFraction ? `${resultWhole}.${resultFraction}` : resultWhole.toString();
}
