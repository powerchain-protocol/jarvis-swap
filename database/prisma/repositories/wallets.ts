import "server-only";
import { getPrisma } from "../client";
import { normalizeSuiAddress } from "@/services/sui/address";

export async function upsertWallet(address: string, network: "mainnet" | "testnet" | "devnet") {
  const prisma = getPrisma();
  const normalized = normalizeSuiAddress(address);
  return prisma.wallet.upsert({
    where: { address: normalized },
    create: { address: normalized, network },
    update: { network },
  });
}

export async function getWallet(address: string) {
  const prisma = getPrisma();
  return prisma.wallet.findUnique({ where: { address: normalizeSuiAddress(address) } });
}
