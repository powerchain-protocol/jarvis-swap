import "server-only";
import { getServerConfig } from "@/config/env";
import { fetchWalletBalances } from "@/services/wallet/data";
import { resolveTrustedToken, findTrustedToken } from "@/services/tokens/trusted";
import { fetchBestPrice } from "@/services/prices";
import type { PricePoint } from "@/services/prices/types";
import { persistPriceSnapshotBestEffort } from "@/services/prices/snapshots";
import { databasePersistenceEnabled } from "@/services/database/persistence";
import { cached, invalidateCache } from "@/utils/cache";
import type { PortfolioAsset, PortfolioHistoryPoint, PortfolioSnapshot } from "@/types/portfolio";

const PRICE_CONCURRENCY = 6;

function decimal(base: string, decimals: number) {
  const raw = BigInt(base || "0");
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = (raw % divisor).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

function knownSymbol(coinType: string) {
  return findTrustedToken(coinType)?.symbol;
}

async function recentHistory(wallet: string): Promise<PortfolioHistoryPoint[]> {
  if (!databasePersistenceEnabled()) return [];
  try {
    const { getPrisma } = await import("@db/prisma/client");
    const rows = await getPrisma().portfolioSnapshot.findMany({
      where: { walletAddress: wallet },
      orderBy: { observedAt: "desc" },
      take: 180,
    });
    return rows.reverse().map((row: { observedAt: Date; totalValueUsd: unknown }) => ({
      observedAt: row.observedAt.toISOString(),
      totalValueUsd: Number(row.totalValueUsd),
    }));
  } catch {
    return [];
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function fetchPortfolio(address: string, force = false): Promise<PortfolioSnapshot> {
  const config = getServerConfig();
  const key = `portfolio:${config.network}:${address.toLowerCase()}`;
  if (force) invalidateCache(key);

  return cached(key, config.portfolioCacheTtlMs, async () => {
    const wallet = await fetchWalletBalances(address);
    const nonZeroBalances = wallet.balances.filter((balance) => BigInt(balance.totalBalance) > 0n);

    const assets = await mapWithConcurrency(nonZeroBalances, PRICE_CONCURRENCY, async (balance): Promise<PortfolioAsset> => {
      const metadata = await resolveTrustedToken(balance.coinType);
      const trustedSymbol = knownSymbol(balance.coinType);
      const symbol = trustedSymbol ?? metadata.symbol;
      const verified = metadata.verified === true;

      let price: PricePoint | undefined;
      try {
        price = await fetchBestPrice({
          symbol,
          coinType: balance.coinType,
          pythFeedId: config.pythFeedIds[symbol],
          cmcId: config.coinMarketCapIds[symbol],
          coingeckoId: config.coinGeckoIds[symbol],
        });
        await persistPriceSnapshotBestEffort(balance.coinType, { ...metadata, symbol, verified }, price);
      } catch {
        // Unpriced assets remain visible and are excluded from the USD total.
      }

      const displayBalance = decimal(balance.totalBalance, metadata.decimals);
      const numericBalance = Number(displayBalance);
      const valueUsd = price && Number.isFinite(numericBalance) && numericBalance >= 0
        ? numericBalance * price.priceUsd
        : undefined;
      const priceAgeMs = price ? Math.max(0, Date.now() - price.updatedAt) : undefined;
      const priceFreshness = !price
        ? "unpriced"
        : priceAgeMs != null && priceAgeMs > Math.floor(config.priceMaxStalenessMs / 2)
          ? "aging"
          : "fresh";

      return {
        coinType: balance.coinType,
        symbol,
        name: metadata.name,
        balanceBaseUnits: balance.totalBalance,
        balance: displayBalance,
        decimals: metadata.decimals,
        iconUrl: metadata.iconUrl,
        verified,
        priceUsd: price?.priceUsd,
        valueUsd: valueUsd != null && Number.isFinite(valueUsd) ? valueUsd : undefined,
        priceProvider: price?.provider,
        priceUpdatedAt: price?.updatedAt,
        priceAgeMs,
        priceFreshness,
      };
    });

    assets.sort((a, b) => (b.valueUsd ?? -1) - (a.valueUsd ?? -1));
    const totalValueUsd = assets.reduce((sum, asset) => sum + (asset.valueUsd ?? 0), 0);
    for (const asset of assets) {
      asset.allocationPct = totalValueUsd > 0 && asset.valueUsd != null ? (asset.valueUsd / totalValueUsd) * 100 : 0;
    }

    if (databasePersistenceEnabled()) {
      try {
        const { getPrisma } = await import("@db/prisma/client");
        await getPrisma().portfolioSnapshot.create({
          data: {
            walletAddress: wallet.address,
            network: config.network,
            totalValueUsd,
            assetCount: assets.length,
            pricedAssetCount: assets.filter((asset) => asset.valueUsd != null).length,
          },
        });
      } catch {
        // Persistence is an index/cache and must never fail a live wallet read.
      }
    }

    return {
      wallet: wallet.address,
      network: config.network,
      totalValueUsd,
      pricedValueUsd: totalValueUsd,
      unpricedAssetCount: assets.filter((asset) => asset.priceUsd == null).length,
      assets,
      history: await recentHistory(wallet.address),
      fetchedAt: Date.now(),
      transport: wallet.transport,
    };
  });
}
