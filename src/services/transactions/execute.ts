"use client";

import { AggregatorClient, Env } from "@cetusprotocol/aggregator-sdk";
import { Transaction } from "@mysten/sui/transactions";
import BN from "bn.js";
import { decimalToBaseUnits, calculateServiceFee } from "@/services/fees/service-fee";
import type { Token } from "@/services/quotes/types";
import { executeSignedTransaction, preflightSignedTransaction, type TransactionPreflight } from "@/services/transactions/preflight";
import { apiErrorMessage, readApiJson } from "@/utils/api-client";
import { API_ROUTES } from "@/constants/routes";

export type SwapRuntimeConfig = {
  network: "mainnet" | "testnet" | "devnet";
  feeBps: number;
  feeWallet?: string;
  cetusEndpoint: string;
  pythUrls: string[];
  swapPackageId?: string;
  swapConfigObjectId?: string;
  requireOnchainFee: boolean;
  minQuoteValidityMs: number;
  allowedCetusProviders?: string[];
  swapExecutionEnabled?: boolean;
  policyFingerprint: string;
};

export type SwapQuoteProof = {
  id: string;
  network: "mainnet" | "testnet" | "devnet";
  issuedAt: number;
  expiresAt: number;
  payCoinType: string;
  receiveCoinType: string;
  payDecimals: number;
  receiveDecimals: number;
  grossAmountInBaseUnits: string;
  netSwapAmountBaseUnits: string;
  amountOutBaseUnits: string;
  minimumAmountOutBaseUnits: string;
  routeCommitment: string;
  policyFingerprint: string;
  serviceFeeBaseUnits: string;
  serviceFeeBps: number;
  serviceFeeRecipient?: string;
  slippageBps: number;
  maxPriceImpactBps: number;
  priceImpactBps: number;
  routing: "best-price" | "lowest-impact" | "custom";
  deadlineMinutes: number;
  signature?: string;
};

export type SwapExecutionRequest = {
  sender: string;
  amountIn: string | number;
  pay: Token;
  receive: Token;
  slippageBps: number;
  minimumAmountOutBaseUnits: string;
  quoteExpiresAt: number;
  deadlineMinutes: number;
  maxPriceImpactBps: number;
  quotedPriceImpactBps: number;
  mevProtection: boolean;
  routing: "best-price" | "lowest-impact" | "custom";
  quoteProof: SwapQuoteProof;
  signTransaction: (transaction: Transaction) => Promise<{ bytes: string; signature: string }>;
  onPreflight?: (preflight: TransactionPreflight) => void;
};

export type SwapExecutionResult = { digest: string; serviceFeeBaseUnits: string; netSwapBaseUnits: string; feeMode: "move-contract" | "atomic-transfer"; preflight: TransactionPreflight };

async function loadRuntimeConfig(): Promise<SwapRuntimeConfig> {
  const response = await fetch(API_ROUTES.swapConfig, { cache: "no-store" });
  const payload = await readApiJson<SwapRuntimeConfig & { error?: unknown }>(response);
  if (!response.ok || !payload) throw new Error(apiErrorMessage(payload, "Unable to load swap configuration."));
  return payload;
}

async function verifyQuote(proof: SwapQuoteProof) {
  const { signature, ...claims } = proof;
  const response = await fetch(API_ROUTES.swapVerify, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ claims, signature }),
    cache: "no-store",
  });
  const payload = await readApiJson<{ ok?: boolean; error?: unknown }>(response);
  if (!response.ok || !payload?.ok) throw new Error(apiErrorMessage(payload, "Quote integrity verification failed."));
}

function assertQuoteMatchesRequest(request: SwapExecutionRequest, gross: bigint, feeBps: number, feeWallet: string | undefined, network: SwapRuntimeConfig["network"]) {
  const proof = request.quoteProof;
  if (proof.network !== network) throw new Error("Quote network changed. Refresh the quote.");
  if (!/^[a-f0-9]{64}$/.test(proof.routeCommitment)) throw new Error("Quote route commitment is invalid.");
  if (!/^[a-f0-9]{64}$/.test(proof.policyFingerprint)) throw new Error("Quote execution policy fingerprint is invalid.");
  if (proof.expiresAt !== request.quoteExpiresAt) throw new Error("Quote expiry mismatch.");
  if (proof.payCoinType !== request.pay.coinType || proof.receiveCoinType !== request.receive.coinType) throw new Error("Quote token mismatch.");
  if (proof.payDecimals !== request.pay.decimals || proof.receiveDecimals !== request.receive.decimals) throw new Error("Token denomination changed. Refresh token metadata and request a new quote.");
  if (proof.grossAmountInBaseUnits !== gross.toString()) throw new Error("Quote input amount mismatch.");
  if (proof.minimumAmountOutBaseUnits !== request.minimumAmountOutBaseUnits) throw new Error("Quote minimum output mismatch.");
  if (proof.slippageBps !== request.slippageBps) throw new Error("Quote slippage mismatch. Refresh after changing settings.");
  if (proof.serviceFeeBps !== feeBps) throw new Error("Service fee policy changed. Refresh the quote.");
  if (proof.maxPriceImpactBps !== request.maxPriceImpactBps) throw new Error("Price-impact protection changed. Refresh the quote.");
  if (proof.priceImpactBps !== request.quotedPriceImpactBps) throw new Error("Signed quote price impact does not match the reviewed quote.");
  if (proof.routing !== request.routing) throw new Error("Quote routing preference changed. Refresh the quote.");
  if (proof.deadlineMinutes !== request.deadlineMinutes) throw new Error("Transaction deadline changed. Refresh the quote.");
  if ((proof.serviceFeeRecipient ?? "") !== (feeWallet ?? "")) throw new Error("Service fee recipient changed. Refresh the quote.");
}

export async function executeSwap(request: SwapExecutionRequest): Promise<SwapExecutionResult> {
  if (Date.now() >= request.quoteExpiresAt) throw new Error("Quote expired before transaction construction.");
  if (!Number.isInteger(request.deadlineMinutes) || request.deadlineMinutes < 1 || request.deadlineMinutes > 60) throw new Error("Transaction deadline must be between 1 and 60 minutes.");
  if (!Number.isInteger(request.maxPriceImpactBps) || request.maxPriceImpactBps < 10 || request.maxPriceImpactBps > 5000) throw new Error("Invalid price-impact protection limit.");
  if (request.quotedPriceImpactBps > request.maxPriceImpactBps) throw new Error("Quoted price impact exceeds the configured protection limit.");
  if (!request.pay.coinType || !request.receive.coinType) throw new Error("Both tokens require valid Sui coin types.");
  if (request.pay.coinType === request.receive.coinType) throw new Error("Pay and receive tokens must be different.");

  const config = await loadRuntimeConfig();
  if (request.quoteProof.policyFingerprint !== config.policyFingerprint) throw new Error("Execution policy changed. Refresh the quote before signing.");
  if (config.swapExecutionEnabled === false || config.network === "devnet") throw new Error("Cetus swap execution is not available on Sui Devnet. Use Testnet or Mainnet for swaps.");
  if (request.slippageBps < 1 || request.slippageBps > 1000) throw new Error("Slippage must be between 0.01% and 10%.");
  if (Date.now() > request.quoteExpiresAt - config.minQuoteValidityMs) throw new Error("Quote is too close to expiry. Refresh before signing.");
  if (config.requireOnchainFee && (!config.swapPackageId || !config.swapConfigObjectId)) throw new Error("On-chain fee enforcement is required but the Move package/config is not configured.");

  const gross = decimalToBaseUnits(request.amountIn, request.pay.decimals);
  assertQuoteMatchesRequest(request, gross, config.feeBps, config.feeWallet, config.network);
  await verifyQuote(request.quoteProof);

  const fee = calculateServiceFee(gross, config.feeBps);
  if (fee.serviceFeeAmount.toString() !== request.quoteProof.serviceFeeBaseUnits || fee.netSwapAmount.toString() !== request.quoteProof.netSwapAmountBaseUnits) {
    throw new Error("Service fee calculation no longer matches the reviewed quote.");
  }

  const client = new AggregatorClient({
    endpoint: config.cetusEndpoint,
    signer: request.sender,
    env: config.network === "mainnet" ? Env.Mainnet : Env.Testnet,
    pythUrls: config.pythUrls,
  });

  const router = await client.findRouters({
    from: request.pay.coinType,
    target: request.receive.coinType,
    amount: new BN(fee.netSwapAmount.toString()),
    byAmountIn: true,
    providers: config.allowedCetusProviders?.length ? config.allowedCetusProviders : undefined,
  });
  if (!router || router.insufficientLiquidity) throw new Error("Cetus route is no longer executable.");
  const routeAmountIn = BigInt(router.amountIn.toString());
  const routeAmountOut = BigInt(router.amountOut.toString());
  if (routeAmountIn !== fee.netSwapAmount) throw new Error("Fresh Cetus route changed the exact input amount. Request a new quote.");
  if (BigInt(request.quoteProof.amountOutBaseUnits) < BigInt(request.minimumAmountOutBaseUnits)) throw new Error("Signed quote output is below its minimum output.");
  if (routeAmountOut < BigInt(request.minimumAmountOutBaseUnits)) throw new Error("Fresh route is below the reviewed minimum output. Request a new quote.");

  const tx = new Transaction();
  tx.setSender(request.sender);
  const grossInputCoin = tx.coin({ balance: gross, type: request.pay.coinType });
  let swapInputCoin = grossInputCoin;
  let feeMode: SwapExecutionResult["feeMode"] = "atomic-transfer";

  if (fee.serviceFeeAmount > 0n && config.swapPackageId && config.swapConfigObjectId) {
    if (!config.feeWallet) throw new Error("Service fee wallet is not configured.");
    const [netCoin] = tx.moveCall({
      target: `${config.swapPackageId}::swap::collect_fee`,
      typeArguments: [request.pay.coinType],
      arguments: [
        tx.object(config.swapConfigObjectId),
        grossInputCoin,
        tx.pure.u64(config.feeBps),
        tx.pure.address(config.feeWallet),
      ],
    });
    swapInputCoin = netCoin;
    feeMode = "move-contract";
  } else if (fee.serviceFeeAmount > 0n) {
    if (!config.feeWallet) throw new Error("Service fee wallet is not configured.");
    const [serviceFeeCoin] = tx.splitCoins(grossInputCoin, [fee.serviceFeeAmount]);
    tx.transferObjects([serviceFeeCoin], config.feeWallet);
  }

  const outputCoin = await client.routerSwapWithMaxAmountIn({
    router,
    txb: tx,
    inputCoin: swapInputCoin,
    slippage: request.slippageBps / 10_000,
    maxAmountIn: new BN(fee.netSwapAmount.toString()),
  });
  tx.transferObjects([outputCoin], request.sender);

  if (Date.now() >= request.quoteExpiresAt) throw new Error("Quote expired while constructing the transaction. Refresh and review again.");
  // Sign without executing first. The signed bytes are simulated and signature-verified
  // server-side before submission, preventing the browser from bypassing preflight.
  const signed = await request.signTransaction(tx);
  const persistence = {
    quoteId: request.quoteProof.id,
    grossAmountInBaseUnits: gross.toString(),
    minimumOutBaseUnits: request.minimumAmountOutBaseUnits,
    serviceFeeBaseUnits: fee.serviceFeeAmount.toString(),
    serviceFeeBps: config.feeBps,
    payCoinType: request.pay.coinType,
    receiveCoinType: request.receive.coinType,
  };
  const { signature: quoteSignature, ...quoteClaims } = request.quoteProof;
  const quoteProof = { claims: quoteClaims as unknown as Record<string, unknown>, signature: quoteSignature };
  // Simulate the exact signed bytes with the same signed quote and persistence
  // intent that the execution relay will enforce. The server derives its
  // authoritative swap intent from the verified quote, not browser metadata.
  const preflight = await preflightSignedTransaction({ bytes: signed.bytes, sender: request.sender, persistence, quoteProof });
  request.onPreflight?.(preflight);
  if (Date.now() >= request.quoteExpiresAt) throw new Error("Quote expired after signing but before submission. The signed transaction was not submitted.");
  const result = await executeSignedTransaction({
    bytes: signed.bytes, signature: signed.signature, sender: request.sender, persistence, quoteProof,
  });
  return { digest: result.digest, serviceFeeBaseUnits: fee.serviceFeeAmount.toString(), netSwapBaseUnits: fee.netSwapAmount.toString(), feeMode, preflight };
}
