import "server-only";
import { getPrisma } from "../client";
import { assertCoinType } from "@/services/sui/address";

export async function upsertToken(input: { network: "mainnet" | "testnet" | "devnet"; coinType: string; symbol: string; name: string; decimals: number; logoUrl?: string; verified?: boolean; metadata?: unknown }) {
  const prisma = getPrisma();
  const coinType = assertCoinType(input.coinType, "coinType");
  return prisma.token.upsert({
    where: { network_coinType: { network: input.network, coinType } },
    create: { ...input, coinType, metadata: input.metadata as never },
    update: { symbol: input.symbol, name: input.name, decimals: input.decimals, logoUrl: input.logoUrl, verified: input.verified ?? false, metadata: input.metadata as never },
  });
}
