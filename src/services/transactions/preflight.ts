"use client";

import { apiErrorMessage, readApiJson } from "@/utils/api-client";

export type TransactionPreflight = {
  ok: boolean;
  status: "success" | "failure";
  gasUsedMist: string;
  computationCostMist: string;
  storageCostMist: string;
  storageRebateMist: string;
  nonRefundableStorageFeeMist: string;
  error?: string;
};

export type SwapExecutionPersistence = { quoteId?: string; grossAmountInBaseUnits: string; minimumOutBaseUnits: string; serviceFeeBaseUnits: string; serviceFeeBps: number; payCoinType: string; receiveCoinType: string };

export type SwapQuoteProofPayload = { claims: Record<string, unknown>; signature?: string };

export async function preflightSignedTransaction(input: { bytes: string; sender: string; persistence?: SwapExecutionPersistence; quoteProof?: SwapQuoteProofPayload; signal?: AbortSignal }): Promise<TransactionPreflight> {
  const response = await fetch("/api/v1/transactions/preflight", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: input.bytes, sender: input.sender, persistence: input.persistence, quoteProof: input.quoteProof }),
    cache: "no-store",
    signal: input.signal,
  });
  const payload = await readApiJson<TransactionPreflight & { error?: unknown }>(response);
  if (!response.ok || !payload?.ok) throw new Error(apiErrorMessage(payload, "Sui transaction simulation failed."));
  return payload;
}

export async function executeSignedTransaction(input: { bytes: string; signature: string; sender: string; idempotencyKey?: string; persistence?: SwapExecutionPersistence; quoteProof?: SwapQuoteProofPayload }): Promise<{ digest: string }> {
  const response = await fetch("/api/v1/transactions/execute", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": input.idempotencyKey ?? crypto.randomUUID() },
    body: JSON.stringify({ transaction: input.bytes, signature: input.signature, sender: input.sender, persistence: input.persistence, quoteProof: input.quoteProof }),
    cache: "no-store",
  });
  const payload = await readApiJson<{ ok?: boolean; digest?: string; error?: unknown }>(response);
  if (!response.ok || !payload?.ok || !payload.digest) throw new Error(apiErrorMessage(payload, "Sui transaction execution failed."));
  return { digest: payload.digest };
}
