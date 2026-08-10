import "server-only";
import { normalizeSuiAddress } from "@/services/sui/address";
import { getServerConfig } from "@/config/env";
import type { PoolActionIntent } from "@/types/pools";

const KINDS = new Set(["open-position", "add-liquidity", "remove-liquidity", "collect-fees", "collect-rewards", "close-position"]);

function baseUnits(value: unknown, name: string) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new Error(`${name} must be an unsigned base-unit integer string.`);
  return value;
}

function optionalInt(value: unknown, name: string, min: number, max: number) {
  if (value == null || value === "") return undefined;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`${name} is outside the allowed range.`);
  return value as number;
}

export function validateLiquidityAction(value: unknown): PoolActionIntent {
  if (!value || typeof value !== "object") throw new Error("Liquidity action body is required.");
  const input = value as Record<string, unknown>;
  if (typeof input.kind !== "string" || !KINDS.has(input.kind)) throw new Error("Unsupported liquidity action kind.");
  const config = getServerConfig();
  const owner = normalizeSuiAddress(String(input.owner ?? ""));
  const poolObjectId = normalizeSuiAddress(String(input.poolObjectId ?? ""));
  if (config.cetusPoolIds.length && !config.cetusPoolIds.map(normalizeSuiAddress).includes(poolObjectId)) throw new Error("Pool is not in CETUS_POOL_IDS allowlist.");
  const needsPosition = !["open-position"].includes(input.kind);
  const positionObjectId = input.positionObjectId ? normalizeSuiAddress(String(input.positionObjectId)) : undefined;
  if (needsPosition && !positionObjectId) throw new Error("positionObjectId is required for this action.");
  const tickLower = optionalInt(input.tickLower, "tickLower", -443636, 443636);
  const tickUpper = optionalInt(input.tickUpper, "tickUpper", -443636, 443636);
  if (input.kind === "open-position" && (tickLower == null || tickUpper == null || tickLower >= tickUpper)) throw new Error("A valid tickLower < tickUpper is required when opening a position.");
  const slippageBps = optionalInt(input.slippageBps, "slippageBps", 1, config.maxSlippageBps);
  const amountABaseUnits = baseUnits(input.amountABaseUnits, "amountABaseUnits");
  const amountBBaseUnits = baseUnits(input.amountBBaseUnits, "amountBBaseUnits");
  const liquidity = baseUnits(input.liquidity, "liquidity");

  if ((input.kind === "open-position" || input.kind === "add-liquidity") && !amountABaseUnits && !amountBBaseUnits) {
    throw new Error("At least one non-zero token amount is required to add liquidity.");
  }
  if (input.kind === "remove-liquidity" && (!liquidity || BigInt(liquidity) <= 0n)) {
    throw new Error("A positive liquidity amount is required to remove liquidity.");
  }
  if (amountABaseUnits === "0" && amountBBaseUnits === "0") {
    throw new Error("Liquidity token amounts cannot both be zero.");
  }

  return {
    kind: input.kind as PoolActionIntent["kind"], owner, poolObjectId, positionObjectId,
    tickLower, tickUpper, slippageBps,
    amountABaseUnits, amountBBaseUnits, liquidity,
  };
}
