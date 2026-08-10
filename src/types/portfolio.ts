export type PortfolioAsset = {
  coinType: string; symbol: string; name: string; balanceBaseUnits: string; balance: string;
  decimals: number; iconUrl?: string | null; priceUsd?: number; valueUsd?: number;
  verified: boolean; priceProvider?: string; priceUpdatedAt?: number;
  priceAgeMs?: number; priceFreshness: "fresh" | "aging" | "unpriced"; allocationPct?: number;
};
export type PortfolioHistoryPoint = { observedAt: string; totalValueUsd: number };
export type PortfolioSnapshot = {
  wallet: string; network: "mainnet" | "testnet" | "devnet"; totalValueUsd: number; pricedValueUsd: number;
  unpricedAssetCount: number; assets: PortfolioAsset[]; history: PortfolioHistoryPoint[];
  fetchedAt: number; transport: string;
};
