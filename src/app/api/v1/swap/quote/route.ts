import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { assertFeeConfiguration } from "@/config/env";
import { baseUnitsToDecimal } from "@/services/fees/service-fee";
import { buildSwapQuote } from "@/services/swap";
import { assertCoinType } from "@/services/sui/address";
import type { RoutingPreference } from "@/services/quotes/types";
import { signQuoteClaims, type SignedQuoteClaims } from "@/services/quotes/integrity";
import { enforceRateLimit, rateLimitHeaders, type RateLimitResult } from "@/services/security/rate-limit";
import { readJson } from "@/utils/safe-actions";
import { AppError } from "@/utils/errors";
import { assertMutationRequest } from "@/services/security/request-security";
import { resolveTradeAssetMetadata } from "@/services/tokens/trade-asset";
import { withConcurrencyBudget } from "@/services/security/concurrency";
import { logEvent, requestCorrelationId } from "@/services/observability/logger";
import { assertSwapOperationsEnabled } from "@/services/system/operations";
import { getExecutionPolicyFingerprint } from "@/services/system/policy-fingerprint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTING = new Set<RoutingPreference>(["best-price", "lowest-impact", "custom"]);
const MAX_WHOLE_AMOUNT_DIGITS = 13;

type QuoteBody = {
  amountIn?: unknown;
  paySymbol?: unknown;
  receiveSymbol?: unknown;
  payCoinType?: unknown;
  receiveCoinType?: unknown;
  payDecimals?: unknown;
  receiveDecimals?: unknown;
  slippageBps?: unknown;
  routing?: unknown;
  maxPriceImpactBps?: unknown;
  deadlineMinutes?: unknown;
};

function symbolCoinType(symbol: string, config: ReturnType<typeof assertFeeConfiguration>) {
  return config.tokenTypes[symbol as keyof typeof config.tokenTypes];
}

function quoteError(message: string, status: number, limit?: RateLimitResult, retryAfter?: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...(limit ? rateLimitHeaders(limit) : {}),
        ...(retryAfter ? { "retry-after": String(retryAfter) } : {}),
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const correlationId = requestCorrelationId(request);
  let limit: RateLimitResult | undefined;
  try {
    assertMutationRequest(request);
    limit = await enforceRateLimit(request, "swap-quote", 45);
    const body = await readJson<QuoteBody>(request, 32_000);

    const amountText = typeof body.amountIn === "string" || typeof body.amountIn === "number" ? String(body.amountIn) : "";
    const paySymbol = typeof body.paySymbol === "string" ? body.paySymbol.trim().toUpperCase().slice(0, 16) : "";
    const receiveSymbol = typeof body.receiveSymbol === "string" ? body.receiveSymbol.trim().toUpperCase().slice(0, 16) : "";
    const requestedPayDecimals = typeof body.payDecimals === "number" ? body.payDecimals : Number.NaN;
    const requestedReceiveDecimals = typeof body.receiveDecimals === "number" ? body.receiveDecimals : Number.NaN;
    const slippageBps = typeof body.slippageBps === "number" ? Math.round(body.slippageBps) : Number.NaN;
    const routing = typeof body.routing === "string" && ROUTING.has(body.routing as RoutingPreference)
      ? body.routing as RoutingPreference
      : null;
    const requestedMaxPriceImpactBps = typeof body.maxPriceImpactBps === "number" ? Math.round(body.maxPriceImpactBps) : Number.NaN;
    const deadlineMinutes = typeof body.deadlineMinutes === "number" ? Math.round(body.deadlineMinutes) : Number.NaN;

    if (!/^\d+(?:\.\d+)?$/.test(amountText)) return quoteError("Enter a valid swap amount.", 400, limit);
    const [wholeAmount] = amountText.split(".");
    if (wholeAmount.replace(/^0+/, "").length > MAX_WHOLE_AMOUNT_DIGITS) return quoteError("Swap amount exceeds the supported maximum.", 400, limit);
    if (!Number.isInteger(requestedPayDecimals) || requestedPayDecimals < 0 || requestedPayDecimals > 18 || !Number.isInteger(requestedReceiveDecimals) || requestedReceiveDecimals < 0 || requestedReceiveDecimals > 18) {
      return quoteError("Invalid token decimals.", 400, limit);
    }
    if (!Number.isInteger(slippageBps) || slippageBps < 1) return quoteError("Slippage must be at least 0.01%.", 400, limit);
    if (!routing) return quoteError("Unsupported routing preference.", 400, limit);
    if (!Number.isInteger(requestedMaxPriceImpactBps) || requestedMaxPriceImpactBps < 10 || requestedMaxPriceImpactBps > 5_000) return quoteError("Maximum price impact must be between 0.10% and 50.00%.", 400, limit);
    if (!Number.isInteger(deadlineMinutes) || deadlineMinutes < 1 || deadlineMinutes > 60) return quoteError("Transaction deadline must be between 1 and 60 minutes.", 400, limit);
    if (!paySymbol || !receiveSymbol || paySymbol === receiveSymbol) return quoteError("Select two different tokens.", 400, limit);

    const config = assertFeeConfiguration();
    assertSwapOperationsEnabled(config);
    const effectiveMaxPriceImpactBps = Math.min(requestedMaxPriceImpactBps, config.maxPriceImpactBps);
    if (slippageBps > config.maxSlippageBps) {
      return quoteError(`Slippage exceeds deployment maximum of ${(config.maxSlippageBps / 100).toFixed(2)}%.`, 400, limit);
    }

    const suppliedPay = typeof body.payCoinType === "string" && body.payCoinType
      ? assertCoinType(body.payCoinType, "pay coin type")
      : undefined;
    const suppliedReceive = typeof body.receiveCoinType === "string" && body.receiveCoinType
      ? assertCoinType(body.receiveCoinType, "receive coin type")
      : undefined;
    const configuredPay = symbolCoinType(paySymbol, config);
    const configuredReceive = symbolCoinType(receiveSymbol, config);

    if (configuredPay && suppliedPay && assertCoinType(configuredPay) !== suppliedPay) {
      throw new AppError("BAD_REQUEST", `Coin type mismatch for verified ${paySymbol}.`);
    }
    if (configuredReceive && suppliedReceive && assertCoinType(configuredReceive) !== suppliedReceive) {
      throw new AppError("BAD_REQUEST", `Coin type mismatch for verified ${receiveSymbol}.`);
    }

    const payCoinType = configuredPay ?? suppliedPay;
    const receiveCoinType = configuredReceive ?? suppliedReceive;
    if (!payCoinType || !receiveCoinType) {
      throw new AppError("CONFIGURATION_ERROR", `${!payCoinType ? paySymbol : receiveSymbol} coin type is not configured.`);
    }

    if (payCoinType === receiveCoinType) {
      throw new AppError("BAD_REQUEST", "Pay and receive tokens must be different.");
    }

    // Financial denomination is server-authoritative. Never trust browser token
    // decimals when converting display amounts to on-chain base units.
    const { payDecimals, receiveDecimals, quote } = await withConcurrencyBudget(
      "swap-quote-upstream",
      { concurrency: config.quoteConcurrency, queueLimit: config.requestQueueLimit, waitMs: config.requestQueueWaitMs },
      async () => {
        const [payAsset, receiveAsset] = await Promise.all([
          resolveTradeAssetMetadata(payCoinType),
          resolveTradeAssetMetadata(receiveCoinType),
        ]);
        const payDecimals = payAsset.decimals;
        const receiveDecimals = receiveAsset.decimals;
        if (requestedPayDecimals !== payDecimals || requestedReceiveDecimals !== receiveDecimals) {
          throw new AppError("CONFLICT", "Token metadata changed. Refresh token metadata before requesting a quote.", { status: 409 });
        }

        const quote = await buildSwapQuote({
          amountText,
          payCoinType,
          receiveCoinType,
          payDecimals,
          receiveDecimals,
          slippageBps,
          maxPriceImpactBps: effectiveMaxPriceImpactBps,
          routing,
          providers: config.allowedCetusProviders,
        });
        return { payDecimals, receiveDecimals, quote };
      },
    );

    // Numeric mirrors are presentation-only. Exact token values remain bigint/text.
    const amountOut = baseUnitsToDecimal(quote.amountOutBaseUnits, receiveDecimals);
    const minimumReceived = baseUnitsToDecimal(quote.minimumAmountOutBaseUnits, receiveDecimals);
    const serviceFeeAmount = baseUnitsToDecimal(quote.serviceFeeBaseUnits, payDecimals);
    const priceImpactBps = quote.priceImpactBps;
    const priceImpact = priceImpactBps / 100;

    const issuedAt = Date.now();
    const expiresAt = issuedAt + config.quoteTtlMs;
    const claims: SignedQuoteClaims = {
      id: quote.quoteId,
      network: config.network,
      issuedAt,
      expiresAt,
      payCoinType,
      receiveCoinType,
      payDecimals,
      receiveDecimals,
      grossAmountInBaseUnits: quote.grossAmountInBaseUnits.toString(),
      netSwapAmountBaseUnits: quote.netSwapAmountBaseUnits.toString(),
      amountOutBaseUnits: quote.amountOutBaseUnits.toString(),
      minimumAmountOutBaseUnits: quote.minimumAmountOutBaseUnits.toString(),
      routeCommitment: quote.routeCommitment,
      policyFingerprint: getExecutionPolicyFingerprint(),
      serviceFeeBaseUnits: quote.serviceFeeBaseUnits.toString(),
      serviceFeeBps: config.feeBps,
      serviceFeeRecipient: config.feeWallet,
      slippageBps,
      maxPriceImpactBps: effectiveMaxPriceImpactBps,
      priceImpactBps,
      routing,
      deadlineMinutes,
    };
    const signature = signQuoteClaims(claims);
    if (config.requireSignedQuotes && !signature) throw new AppError("CONFIGURATION_ERROR", "Signed quotes are required but quote signing is unavailable.");

    logEvent("info", "swap.quote.created", { requestId: correlationId, network: config.network, provider: quote.provider, durationMs: Date.now() - startedAt });
    return NextResponse.json({
      ...claims,
      signature,
      signed: Boolean(signature),
      mode: "live" as const,
      amountOut,
      amountOutText: quote.amountOutText,
      amountOutBaseUnits: quote.amountOutBaseUnits.toString(),
      serviceFeeAmount,
      serviceFeeAmountText: quote.serviceFeeText,
      rate: quote.rate,
      priceImpact,
      priceImpactBps,
      protections: {
        slippageBps,
        maxPriceImpactBps: effectiveMaxPriceImpactBps,
        quoteTtlMs: config.quoteTtlMs,
        minQuoteValidityMs: config.minQuoteValidityMs,
        minOutputEnforced: true,
        atomicServiceFee: true,
        signedQuote: Boolean(signature),
        onchainFeeRequired: config.requireOnchainFee,
      },
      minimumReceived,
      minimumReceivedText: quote.minimumAmountOutText,
      // Gas is transaction-dependent and must come from the signed-transaction
      // simulation. Never return a fabricated static SUI gas estimate here.
      networkFee: null,
      route: quote.route.length ? [paySymbol, ...quote.route, receiveSymbol] : [paySymbol, "Cetus Aggregator", receiveSymbol],
      provider: quote.provider,
    }, {
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...rateLimitHeaders(limit),
      },
    });
  } catch (cause) {
    logEvent("warn", "swap.quote.failed", { requestId: correlationId, durationMs: Date.now() - startedAt }, cause);
    if (cause instanceof AppError) {
      const retryAfter = typeof cause.details?.retryAfter === "number" ? cause.details.retryAfter : undefined;
      const fallback = cause.code === "CONFIGURATION_ERROR" ? "Swap execution is not configured." : "Unable to create quote.";
      return quoteError(cause.expose ? cause.message : fallback, cause.status, limit, retryAfter);
    }
    return quoteError("Unable to create Cetus quote.", 502, limit);
  }
}
