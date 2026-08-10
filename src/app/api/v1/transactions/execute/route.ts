import { NextRequest, NextResponse } from "next/server";
import { verifyTransactionSignature } from "@mysten/sui/verify";
import { normalizeSuiAddress } from "@/services/sui/address";
import { createSuiGrpcClient, executeTransactionGrpc, simulateTransactionGrpc } from "@/services/sui/grpc";
import { getServerConfig } from "@/config/env";
import { assertSwapOperationsEnabled } from "@/services/system/operations";
import { persistSubmittedSwapBestEffort } from "@/services/database/persistence";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { acquireIdempotency, completeIdempotency, idempotencyKey, payloadHash, releaseIdempotency } from "@/services/security/idempotency";
import { AppError, publicError } from "@/utils/errors";
import { parseTransactionEnvelope } from "@/services/transactions/envelope";
import { readJson } from "@/utils/safe-actions";
import { assertSimulatedSwapOutcome, validateSwapPersistenceAgainstQuote } from "@/services/transactions/persistence-validation";
import { assertEncodedSignature, decodeBase64Strict } from "@/utils/encoding";
import { assertJarvisTransactionPolicy } from "@/services/transactions/policy";
import { assertMutationRequest } from "@/services/security/request-security";
import { assertWalletSession } from "@/services/session/server";
import { logEvent, requestCorrelationId } from "@/services/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExecuteBody = {
  transaction?: unknown;
  signature?: unknown;
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
  const startedAt = Date.now();
  const correlationId = requestCorrelationId(request);
  let idem: string | undefined;
  let hash = "";
  let reservationAcquired = false;
  let submissionAttempted = false;

  try {
    assertMutationRequest(request);
    const limit = await enforceRateLimit(request, "tx-execute", 15);
    const body = await readJson<ExecuteBody>(request, 450_000);
    idem = idempotencyKey(request.headers);
    if (!idem) throw new AppError("BAD_REQUEST", "Idempotency-Key is required for transaction execution.");

    hash = payloadHash(body);
    const config = getServerConfig();
    if (body.persistence) assertSwapOperationsEnabled(config);
    const acquired = await acquireIdempotency(idem, hash, {
      resultTtlMs: config.idempotencyTtlMs,
      lockTtlMs: config.idempotencyLockTtlMs,
    });

    if (acquired.state === "replay") {
      return NextResponse.json(acquired.body, {
        status: acquired.status,
        headers: {
          "cache-control": "no-store",
          "idempotency-replayed": "true",
          ...rateLimitHeaders(limit),
        },
      });
    }
    if (acquired.state === "processing") {
      return NextResponse.json(
        { ok: false, error: { code: "CONFLICT", message: "An identical transaction request is already being processed." } },
        { status: 409, headers: { "cache-control": "no-store", "retry-after": String(acquired.retryAfter), ...rateLimitHeaders(limit) } },
      );
    }
    reservationAcquired = true;

    const sender = normalizeSuiAddress(String(body.sender ?? ""));
    assertWalletSession(request, sender);
    if (body.persistence && !body.quoteProof) throw new AppError("BAD_REQUEST", "Signed quote proof is required for swap execution.");
    const persistence = body.persistence
      ? validateSwapPersistenceAgainstQuote(body.quoteProof, body.persistence, config.feeBps, config.feeWallet).persistence
      : undefined;
    const signature = assertEncodedSignature(body.signature);
    const bytes = decodeBase64Strict(body.transaction, { minBytes: 16, maxBytes: 300_000, label: "transaction bytes" });
    assertJarvisTransactionPolicy(bytes, sender);

    // Verify the wallet signature before using server-side execution resources.
    // Passing the expected address prevents a valid signature from another
    // account being replayed against this endpoint.
    await verifyTransactionSignature(bytes, signature, { address: sender, client: createSuiGrpcClient() as never });

    // Re-simulate immediately before submission. This closes the gap between
    // UI review and execution if object versions or pool state changed.
    const simulation = parseTransactionEnvelope(await simulateTransactionGrpc(bytes));
    if (!simulation.success) {
      throw new AppError("BAD_REQUEST", simulation.failureMessage ?? "Sui preflight failed immediately before execution.", { status: 422 });
    }
    if (persistence) assertSimulatedSwapOutcome(simulation.raw, persistence, sender, config.feeWallet, simulation.gasUsedMist);

    // From this point onward an ambiguous upstream/network error may have
    // happened after the transaction reached Sui. Keep the idempotency
    // reservation instead of releasing it, preventing an unsafe duplicate.
    submissionAttempted = true;
    const result = parseTransactionEnvelope(await executeTransactionGrpc(bytes, signature));
    if (!result.success) {
      const body = { ok: false, error: { code: "BAD_REQUEST", message: result.failureMessage ?? "Sui transaction failed." } };
      await completeIdempotency(idem, hash, 422, body, config.idempotencyTtlMs);
      return NextResponse.json(body, { status: 422, headers: { "cache-control": "no-store", ...rateLimitHeaders(limit) } });
    }

    const digest = result.digest;
    if (!digest) throw new AppError("UPSTREAM_ERROR", "Sui execution returned no transaction digest.");

    if (persistence) {
      await persistSubmittedSwapBestEffort({
        digest,
        quoteId: persistence.quoteId,
        walletAddress: sender,
        network: config.network,
        grossAmountInBaseUnits: persistence.grossAmountInBaseUnits,
        minimumOutBaseUnits: persistence.minimumOutBaseUnits,
        serviceFeeBaseUnits: persistence.serviceFeeBaseUnits,
        serviceFeeBps: persistence.serviceFeeBps,
        feeRecipient: config.feeWallet,
        feeCoinType: persistence.payCoinType,
      });
    }

    logEvent("info", "transaction.submitted", { requestId: correlationId, network: config.network, durationMs: Date.now() - startedAt, swap: Boolean(persistence) });
    const responseBody = { ok: true, digest, status: "submitted" as const };
    await completeIdempotency(idem, hash, 200, responseBody, config.idempotencyTtlMs);
    return NextResponse.json(responseBody, {
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...rateLimitHeaders(limit) },
    });
  } catch (cause) {
    logEvent("warn", "transaction.execution_failed", { requestId: correlationId, durationMs: Date.now() - startedAt, submissionAttempted }, cause);
    if (idem && hash && reservationAcquired && !submissionAttempted) await releaseIdempotency(idem, hash);
    const error = publicError(cause);
    const details = cause instanceof AppError ? cause.details : undefined;
    const retryAfter = details?.retryAfter ? String(details.retryAfter) : undefined;
    const limitHeaders = typeof details?.limit === "number" && typeof details?.resetAt === "number"
      ? rateLimitHeaders({
          limit: details.limit,
          remaining: typeof details.remaining === "number" ? details.remaining : 0,
          resetAt: details.resetAt,
          windowMs: typeof details.windowMs === "number" ? details.windowMs : 60_000,
        })
      : {};
    return NextResponse.json(error.body, {
      status: error.status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...(retryAfter ? { "retry-after": retryAfter } : {}),
        ...limitHeaders,
      },
    });
  }
}
