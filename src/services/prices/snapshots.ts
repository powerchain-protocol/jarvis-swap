import "server-only";
import type { PricePoint } from "./types";
import { logEvent } from "@/services/observability/logger";
import { PUBLIC_SUI_NETWORK } from "@/constants/network";
import { databasePersistenceEnabled } from "@/services/database/persistence";
export async function persistPriceSnapshotBestEffort(coinType: string, token: {symbol:string;name:string;decimals:number;verified:boolean}, point: PricePoint) {
  if (!databasePersistenceEnabled()) return;
  try {
    const { getPrisma } = await import("@db/prisma/client"); const db = getPrisma();
    const network = PUBLIC_SUI_NETWORK;
    const row = await db.token.upsert({ where:{network_coinType:{network,coinType}}, create:{network,coinType,symbol:token.symbol,name:token.name,decimals:token.decimals,verified:token.verified}, update:{symbol:token.symbol,name:token.name,decimals:token.decimals} });
    await db.tokenPrice.create({data:{tokenId:row.id,provider:point.provider,priceUsd:point.priceUsd,confidenceBps: point.confidence && point.priceUsd ? Math.round(point.confidence/point.priceUsd*10000):null,observedAt:new Date(point.updatedAt)}});
  } catch (e) { logEvent("error", "prices.snapshot.persistence_failed", {}, e); }
}
