"use client";

import { apiErrorMessage, readApiJson } from "@/utils/api-client";
import type { Quote, QuoteRequest } from "./types";
import { API_ROUTES } from "@/constants/routes";

function isQuote(value: unknown): value is Quote {
  if (!value || typeof value !== "object") return false;
  const q = value as Partial<Quote>;
  return q.mode === "live"
    && typeof q.id === "string"
    && (q.network === "mainnet" || q.network === "testnet" || q.network === "devnet")
    && typeof q.amountOut === "number" && Number.isFinite(q.amountOut) && q.amountOut > 0
    && typeof q.amountOutText === "string" && /^\d+(?:\.\d+)?$/.test(q.amountOutText)
    && typeof q.amountOutBaseUnits === "string" && /^\d+$/.test(q.amountOutBaseUnits)
    && typeof q.routeCommitment === "string" && /^[a-f0-9]{64}$/.test(q.routeCommitment)
    && typeof q.policyFingerprint === "string" && /^[a-f0-9]{64}$/.test(q.policyFingerprint)
    && typeof q.minimumAmountOutBaseUnits === "string" && /^\d+$/.test(q.minimumAmountOutBaseUnits)
    && typeof q.grossAmountInBaseUnits === "string" && /^\d+$/.test(q.grossAmountInBaseUnits)
    && typeof q.netSwapAmountBaseUnits === "string" && /^\d+$/.test(q.netSwapAmountBaseUnits)
    && typeof q.serviceFeeAmountText === "string" && /^\d+(?:\.\d+)?$/.test(q.serviceFeeAmountText)
    && typeof q.serviceFeeBaseUnits === "string" && /^\d+$/.test(q.serviceFeeBaseUnits)
    && typeof q.minimumReceivedText === "string" && /^\d+(?:\.\d+)?$/.test(q.minimumReceivedText)
    && typeof q.priceImpactBps === "number" && Number.isInteger(q.priceImpactBps) && q.priceImpactBps >= 0
    && typeof q.maxPriceImpactBps === "number" && Number.isInteger(q.maxPriceImpactBps) && q.maxPriceImpactBps >= 10 && q.maxPriceImpactBps <= 5000
    && ["best-price", "lowest-impact", "custom"].includes(String(q.routing))
    && typeof q.deadlineMinutes === "number" && Number.isInteger(q.deadlineMinutes) && q.deadlineMinutes >= 1 && q.deadlineMinutes <= 60
    && typeof q.expiresAt === "number" && Number.isFinite(q.expiresAt)
    && typeof q.payCoinType === "string" && typeof q.receiveCoinType === "string"
    && typeof q.payDecimals === "number" && Number.isInteger(q.payDecimals) && q.payDecimals >= 0 && q.payDecimals <= 18
    && typeof q.receiveDecimals === "number" && Number.isInteger(q.receiveDecimals) && q.receiveDecimals >= 0 && q.receiveDecimals <= 18;
}

export async function requestQuote(request: QuoteRequest, signal?: AbortSignal): Promise<Quote> {
  const response = await fetch(API_ROUTES.quote, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      // Preserve the user's decimal text exactly. Converting through Number here
      // can silently round large or high-precision blockchain amounts.
      amountIn: request.amountIn,
      paySymbol: request.pay.symbol,
      receiveSymbol: request.receive.symbol,
      payCoinType: request.pay.coinType,
      receiveCoinType: request.receive.coinType,
      payDecimals: request.pay.decimals,
      receiveDecimals: request.receive.decimals,
      slippageBps: request.slippageBps,
      routing: request.routing,
      maxPriceImpactBps: request.maxPriceImpactBps,
      deadlineMinutes: request.deadlineMinutes,
    }),
    cache: "no-store",
    signal,
  });
  const payload = await readApiJson<unknown>(response);
  if (!response.ok) throw new Error(apiErrorMessage(payload, "Unable to get a quote."));
  if (!isQuote(payload)) throw new Error("Quote service returned an invalid response.");
  return payload;
}
