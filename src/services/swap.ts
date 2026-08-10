import "server-only";

import { createHash } from "node:crypto";
import { assertFeeConfiguration, getServerConfig } from "@/config/env";
import { findCetusRoute } from "@/lib/cetus";
import {
  baseUnitRatioToNumber,
  baseUnitsToDecimalString,
  calculateServiceFee,
  decimalToBaseUnits,
} from "@/services/fees/service-fee";
import { assertCoinType } from "@/services/sui/address";
import { AppError } from "@/utils/errors";

export type SwapRouting = "best-price" | "lowest-impact" | "custom";

export type BuildSwapQuoteInput = {
  amountText: string;
  payCoinType: string;
  receiveCoinType: string;
  payDecimals: number;
  receiveDecimals: number;
  slippageBps: number;
  maxPriceImpactBps: number;
  routing: SwapRouting;
  providers?: string[];
};

export type SwapQuoteCore = {
  grossAmountInBaseUnits: bigint;
  serviceFeeBaseUnits: bigint;
  netSwapAmountBaseUnits: bigint;
  amountOutBaseUnits: bigint;
  minimumAmountOutBaseUnits: bigint;
  grossAmountText: string;
  serviceFeeText: string;
  netSwapAmountText: string;
  amountOutText: string;
  minimumAmountOutText: string;
  rate: number;
  priceImpactBps: number;
  quoteId: string;
  route: string[];
  provider: string;
  routeCommitment: string;
};


function createRouteCommitment(input: {
  network: "mainnet" | "testnet" | "devnet";
  payCoinType: string;
  receiveCoinType: string;
  grossAmountInBaseUnits: bigint;
  netSwapAmountBaseUnits: bigint;
  amountOutBaseUnits: bigint;
  minimumAmountOutBaseUnits: bigint;
  quoteId: string;
  provider: string;
  route: readonly string[];
}) {
  return createHash("sha256")
    .update([
      input.network,
      input.payCoinType,
      input.receiveCoinType,
      input.grossAmountInBaseUnits.toString(),
      input.netSwapAmountBaseUnits.toString(),
      input.amountOutBaseUnits.toString(),
      input.minimumAmountOutBaseUnits.toString(),
      input.quoteId,
      input.provider,
      ...input.route,
    ].join("\0"))
    .digest("hex");
}

function assertDecimals(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0 || value > 18) {
    throw new AppError("BAD_REQUEST", `${label} decimals must be an integer between 0 and 18.`);
  }
}

/**
 * Builds the authoritative server-side swap quote core. All financial values are
 * bigint base units until presentation strings are produced at the boundary.
 */
export async function buildSwapQuote(input: BuildSwapQuoteInput): Promise<SwapQuoteCore> {
  const config = assertFeeConfiguration();
  const payCoinType = assertCoinType(input.payCoinType, "pay coin type");
  const receiveCoinType = assertCoinType(input.receiveCoinType, "receive coin type");
  if (payCoinType === receiveCoinType) throw new AppError("BAD_REQUEST", "Pay and receive tokens must be different.");

  assertDecimals(input.payDecimals, "Pay token");
  assertDecimals(input.receiveDecimals, "Receive token");
  if (!Number.isInteger(input.slippageBps) || input.slippageBps < 1 || input.slippageBps > config.maxSlippageBps) {
    throw new AppError("BAD_REQUEST", `Slippage must be between 0.01% and ${(config.maxSlippageBps / 100).toFixed(2)}%.`);
  }
  if (!Number.isInteger(input.maxPriceImpactBps) || input.maxPriceImpactBps < 10 || input.maxPriceImpactBps > config.maxPriceImpactBps) {
    throw new AppError("BAD_REQUEST", `Maximum price impact must be between 0.10% and ${(config.maxPriceImpactBps / 100).toFixed(2)}%.`);
  }

  const gross = decimalToBaseUnits(input.amountText, input.payDecimals);
  const fee = calculateServiceFee(gross, config.feeBps);
  const route = await findCetusRoute({
    from: payCoinType,
    target: receiveCoinType,
    amount: fee.netSwapAmount,
    providers: input.providers?.length ? input.providers : config.allowedCetusProviders,
  });
  if (route.amountOut <= 0n) throw new AppError("UPSTREAM_ERROR", "Liquidity router returned a zero-output quote.");

  const priceImpactBps = route.deviationRatio == null ? 0 : Math.round(Math.abs(route.deviationRatio) * 10_000);
  if (!Number.isFinite(priceImpactBps) || priceImpactBps < 0) {
    throw new AppError("UPSTREAM_ERROR", "Liquidity router returned an invalid price impact.");
  }
  if (priceImpactBps > input.maxPriceImpactBps) {
    throw new AppError(
      "BAD_REQUEST",
      `Price impact ${(priceImpactBps / 100).toFixed(2)}% exceeds protection limit ${(input.maxPriceImpactBps / 100).toFixed(2)}%.`,
      { status: 422 },
    );
  }

  const minimum = route.amountOut * BigInt(10_000 - input.slippageBps) / 10_000n;
  if (minimum <= 0n) throw new AppError("BAD_REQUEST", "Minimum received amount is zero after slippage protection.");

  const routeCommitment = createRouteCommitment({
    network: config.network,
    payCoinType,
    receiveCoinType,
    grossAmountInBaseUnits: gross,
    netSwapAmountBaseUnits: fee.netSwapAmount,
    amountOutBaseUnits: route.amountOut,
    minimumAmountOutBaseUnits: minimum,
    quoteId: route.quoteId,
    provider: route.provider,
    route: route.paths,
  });

  return {
    grossAmountInBaseUnits: gross,
    serviceFeeBaseUnits: fee.serviceFeeAmount,
    netSwapAmountBaseUnits: fee.netSwapAmount,
    amountOutBaseUnits: route.amountOut,
    minimumAmountOutBaseUnits: minimum,
    grossAmountText: baseUnitsToDecimalString(gross, input.payDecimals),
    serviceFeeText: baseUnitsToDecimalString(fee.serviceFeeAmount, input.payDecimals),
    netSwapAmountText: baseUnitsToDecimalString(fee.netSwapAmount, input.payDecimals),
    amountOutText: baseUnitsToDecimalString(route.amountOut, input.receiveDecimals),
    minimumAmountOutText: baseUnitsToDecimalString(minimum, input.receiveDecimals),
    rate: baseUnitRatioToNumber({
      numeratorBaseUnits: route.amountOut,
      numeratorDecimals: input.receiveDecimals,
      denominatorBaseUnits: gross,
      denominatorDecimals: input.payDecimals,
    }),
    priceImpactBps,
    quoteId: route.quoteId,
    route: route.paths,
    provider: route.provider,
    routeCommitment,
  };
}

export function isSwapExecutionConfigured() {
  // Configuration/status endpoints must remain readable while the fee wallet is
  // intentionally TBA. Actual quoting/execution continues to fail closed via
  // assertFeeConfiguration().
  const config = getServerConfig();
  return {
    enabled: (config.feeBps === 0 || Boolean(config.feeWallet)) && config.network !== "devnet",
    network: config.network,
    feeBps: config.feeBps,
    feeWallet: config.feeWallet,
    reason: config.feeBps > 0 && !config.feeWallet
      ? "Service fee wallet is not configured."
      : config.network === "devnet"
        ? "Cetus swap routing is not enabled on Sui Devnet."
        : undefined,
  } as const;
}
