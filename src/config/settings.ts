export const SWAP_SETTINGS_STORAGE_KEY = "jarvis-swap:settings:v2";

export type RoutingPreference = "best-price" | "lowest-impact" | "custom";

export type SwapSettings = {
  slippageBps: number;
  deadlineMinutes: number;
  routing: RoutingPreference;
  maxPriceImpactBps: number;
  mevProtection: boolean;
  expertMode: boolean;
};

export const DEFAULT_SWAP_SETTINGS: SwapSettings = {
  slippageBps: 50,
  deadlineMinutes: 20,
  routing: "best-price",
  maxPriceImpactBps: 300,
  mevProtection: true,
  expertMode: false,
};

export function normalizeSwapSettings(value: Partial<SwapSettings> | null | undefined): SwapSettings {
  const input = value ?? {};
  const routing: RoutingPreference = ["best-price", "lowest-impact", "custom"].includes(String(input.routing))
    ? input.routing as RoutingPreference
    : DEFAULT_SWAP_SETTINGS.routing;
  return {
    slippageBps: clampInt(input.slippageBps, 1, 1000, DEFAULT_SWAP_SETTINGS.slippageBps),
    deadlineMinutes: clampInt(input.deadlineMinutes, 1, 60, DEFAULT_SWAP_SETTINGS.deadlineMinutes),
    routing,
    maxPriceImpactBps: clampInt(input.maxPriceImpactBps, 10, 5000, DEFAULT_SWAP_SETTINGS.maxPriceImpactBps),
    mevProtection: typeof input.mevProtection === "boolean" ? input.mevProtection : DEFAULT_SWAP_SETTINGS.mevProtection,
    expertMode: typeof input.expertMode === "boolean" ? input.expertMode : DEFAULT_SWAP_SETTINGS.expertMode,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}
