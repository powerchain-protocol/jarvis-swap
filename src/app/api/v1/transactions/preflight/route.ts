import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { NextRequest } from "next/server";
import { normalizeSuiAddress } from "@/services/sui/address";
import { simulateTransactionGrpc } from "@/services/sui/grpc";
import { parseTransactionEnvelope } from "@/services/transactions/envelope";
import { AppError } from "@/utils/errors";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";
import { readJson } from "@/utils/safe-actions";
import { decodeBase64Strict } from "@/utils/encoding";
import { assertJarvisTransactionPolicy } from "@/services/transactions/policy";
import { assertMutationRequest } from "@/services/security/request-security";
import { assertWalletSession } from "@/services/session/server";
import { getServerConfig } from "@/config/env";
import { assertSwapOperationsEnabled } from "@/services/system/operations";
import { assertSimulatedSwapOutcome, validateSwapPersistenceAgainstQuote } from "@/services/transactions/persistence-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PreflightBody = {
  transaction?: unknown;
  sender?: unknown;
  persistence?: {
    quoteId?: string;
    grossAmountInBaseUnits?: string;
    minimumOutBaseUnits?: string;
    serviceFeeBaseUnits?: string;
    serviceFeeBps?: number;
    payCoinType?: string;
    receiveCoinType?: string;
  };
  quoteProof?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    assertMutationRequest(request);
    const limit = await enforceRateLimit(request, "tx-preflight", 30);
    const body = await readJson<PreflightBody>(request, 450_000);
    const sender = normalizeSuiAddress(String(body.sender ?? ""));
    assertWalletSession(request, sender);
    const bytes = decodeBase64Strict(body.transaction, { minBytes: 16, maxBytes: 300_000, label: "transaction bytes" });
    const policy = assertJarvisTransactionPolicy(bytes, sender);
    const config = getServerConfig();
    if (body.persistence) assertSwapOperationsEnabled(config);
    if (body.persistence && !body.quoteProof) throw new AppError("BAD_REQUEST", "Signed quote proof is required for swap preflight.");
    const persistence = body.persistence
      ? validateSwapPersistenceAgainstQuote(body.quoteProof, body.persistence, config.feeBps, config.feeWallet).persistence
      : undefined;
    const parsed = parseTransactionEnvelope(await simulateTransactionGrpc(bytes));
    if (!parsed.success) {
      return jsonNoStore({ ok: false, status: "failure", sender, gasUsedMist: parsed.gasUsedMist.toString(), error: parsed.failureMessage ?? "Sui simulation rejected the transaction." }, { status: 422, headers: rateLimitHeaders(limit) });
    }
    const swapOutcome = persistence
      ? assertSimulatedSwapOutcome(parsed.raw, persistence, sender, config.feeWallet, parsed.gasUsedMist)
      : undefined;
    return jsonNoStore({
      ok: true,
      status: "success",
      sender,
      gasUsedMist: parsed.gasUsedMist.toString(),
      computationCostMist: parsed.computationCostMist.toString(),
      storageCostMist: parsed.storageCostMist.toString(),
      storageRebateMist: parsed.storageRebateMist.toString(),
      nonRefundableStorageFeeMist: parsed.nonRefundableStorageFeeMist.toString(),
      transaction: { commandCount: policy.commandCount, inputCount: policy.inputCount, gasBudgetMist: policy.gasBudgetMist ?? null },
      swapOutcome,
    }, { headers: rateLimitHeaders(limit) });
  } catch (cause) {
    return apiErrorResponse(cause, "Unable to simulate transaction.");
  }
}
