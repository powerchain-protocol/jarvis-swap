import { NextRequest } from "next/server";
import { waitForTransactionGrpc } from "@/services/sui/grpc";
import { persistConfirmedSwapBestEffort } from "@/services/database/persistence";
import { parseTransactionEnvelope } from "@/services/transactions/envelope";
import { enforceRateLimit, rateLimitHeaders } from "@/services/security/rate-limit";
import { apiErrorResponse, jsonNoStore } from "@/utils/api-response";
import { AppError } from "@/utils/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIGEST_RE = /^[1-9A-HJ-NP-Za-km-z]{32,64}$/;

export async function GET(request: NextRequest, context: { params: Promise<{ digest: string }> }) {
  try {
    const limit = await enforceRateLimit(request, "tx-status", 120);
    const { digest } = await context.params;
    if (!DIGEST_RE.test(digest)) throw new AppError("BAD_REQUEST", "Invalid Sui transaction digest.");
    const tx = parseTransactionEnvelope(await waitForTransactionGrpc(digest));
    if (!tx.success) {
      return jsonNoStore({ ok: false, digest: tx.digest ?? digest, status: "failure", error: tx.failureMessage ?? "Transaction failed." }, { status: 422, headers: rateLimitHeaders(limit) });
    }
    const checkpoint = tx.checkpoint != null ? BigInt(tx.checkpoint) : undefined;
    await persistConfirmedSwapBestEffort(tx.digest ?? digest, checkpoint);
    return jsonNoStore({ ok: true, digest: tx.digest ?? digest, status: "success", checkpoint: tx.checkpoint ?? null, timestampMs: tx.timestampMs ?? null }, { headers: rateLimitHeaders(limit) });
  } catch (cause) {
    if (cause instanceof AppError) return apiErrorResponse(cause);
    return apiErrorResponse(new AppError("UPSTREAM_ERROR", "Transaction confirmation is not available yet.", { status: 504, cause }));
  }
}
