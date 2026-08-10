import "server-only";
import { getPrisma } from "../client";
import { upsertWallet } from "./wallets";

export async function recordSubmittedSwap(input: {
  digest: string; quoteId?: string; walletAddress: string; network: "mainnet" | "testnet" | "devnet";
  grossAmountInBaseUnits: string; minimumOutBaseUnits: string; serviceFeeBaseUnits: string; serviceFeeBps: number; feeRecipient?: string; feeCoinType?: string;
}) {
  const prisma = getPrisma();
  const wallet = await upsertWallet(input.walletAddress, input.network);
  return prisma.swapTransaction.upsert({
    where: { digest: input.digest },
    create: {
      digest: input.digest, quoteId: input.quoteId, walletId: wallet.id, network: input.network,
      grossAmountInBaseUnits: input.grossAmountInBaseUnits, minimumOutBaseUnits: input.minimumOutBaseUnits,
      serviceFeeBaseUnits: input.serviceFeeBaseUnits, serviceFeeBps: input.serviceFeeBps, status: "submitted",
      feeCollection: input.feeRecipient && input.feeCoinType && BigInt(input.serviceFeeBaseUnits) > 0n ? {
        create: { recipient: input.feeRecipient, coinType: input.feeCoinType, amountBaseUnits: input.serviceFeeBaseUnits, feeBps: input.serviceFeeBps },
      } : undefined,
    },
    update: {},
  });
}

export async function markSwapConfirmed(digest: string, checkpoint?: bigint, gasUsedMist?: string) {
  const prisma = getPrisma();
  return prisma.swapTransaction.update({
    where: { digest },
    data: { status: "confirmed", confirmedAt: new Date(), checkpoint, gasUsedMist },
  });
}
