export const FIAT_CURRENCIES = ["USD", "EUR"] as const;
export type FiatCurrency = (typeof FIAT_CURRENCIES)[number];

const FORMATTERS: Record<FiatCurrency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
  EUR: new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }),
};

export function isFiatCurrency(value: unknown): value is FiatCurrency {
  return typeof value === "string" && FIAT_CURRENCIES.includes(value as FiatCurrency);
}

export function formatFiat(value: number, currency: FiatCurrency = "USD") {
  if (!Number.isFinite(value)) return "—";
  return FORMATTERS[currency].format(value);
}

export function usdToFiat(usd: number, currency: FiatCurrency, eurPerUsd?: number) {
  if (!Number.isFinite(usd)) throw new Error("USD value must be finite.");
  if (currency === "USD") return usd;
  if (!eurPerUsd || !Number.isFinite(eurPerUsd) || eurPerUsd <= 0) throw new Error("A valid EUR/USD conversion rate is required.");
  return usd * eurPerUsd;
}
