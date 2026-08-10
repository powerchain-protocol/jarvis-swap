import "server-only";
import { getPrisma } from "@db/prisma/client";
import { databasePersistenceEnabled } from "@/services/database/persistence";
import { getTransactionGrpc } from "@/services/sui/grpc";

export type ReconcileSummary = { scanned: number; confirmed: number; failed: number; missing: number; errors: number };
function jsonSafe(value: unknown) { return JSON.parse(JSON.stringify(value)); }

export async function reconcilePendingSwaps(limit = 50): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { scanned: 0, confirmed: 0, failed: 0, missing: 0, errors: 0 };
  if (!databasePersistenceEnabled()) return summary;
  const prisma = getPrisma();
  const rows = await prisma.swapTransaction.findMany({ where: { status: { in: ["submitted", "signed"] } }, orderBy: { submittedAt: "asc" }, take: Math.max(1, Math.min(200, limit)) });
  for (const row of rows) {
    summary.scanned++;
    try {
      const tx = await getTransactionGrpc(row.digest);
      if (!tx.digest) { summary.missing++; continue; }
      if (tx.status === "success") {
        await prisma.swapTransaction.update({ where: { digest: row.digest }, data: { status: "confirmed", confirmedAt: new Date(), checkpoint: tx.checkpoint ? BigInt(tx.checkpoint) : undefined, gasUsedMist: tx.gasUsedMist, failureReason: null } });
        summary.confirmed++;
      } else {
        await prisma.swapTransaction.update({ where: { digest: row.digest }, data: { status: "failed", failureReason: tx.error ?? "Sui execution failed", checkpoint: tx.checkpoint ? BigInt(tx.checkpoint) : undefined, gasUsedMist: tx.gasUsedMist } });
        summary.failed++;
      }
      await prisma.chainTransactionObservation.upsert({
        where: { digest: row.digest },
        create: { digest: row.digest, network: row.network, status: tx.status, sender: tx.sender, checkpoint: tx.checkpoint ? BigInt(tx.checkpoint) : undefined, gasUsedMist: tx.gasUsedMist, balanceChanges: jsonSafe(tx.balanceChanges), events: jsonSafe(tx.events), observedAt: new Date() },
        update: { status: tx.status, sender: tx.sender, checkpoint: tx.checkpoint ? BigInt(tx.checkpoint) : undefined, gasUsedMist: tx.gasUsedMist, balanceChanges: jsonSafe(tx.balanceChanges), events: jsonSafe(tx.events), observedAt: new Date() },
      });
    } catch { summary.errors++; }
  }
  return summary;
}

export async function cleanupOperationalData() {
  if (!databasePersistenceEnabled()) return { rateLimits: 0, idempotency: 0 };
  const prisma = getPrisma(); const now = new Date();
  const [rateLimits, idempotency] = await Promise.all([
    prisma.apiRateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.apiIdempotency.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return { rateLimits: rateLimits.count, idempotency: idempotency.count };
}
