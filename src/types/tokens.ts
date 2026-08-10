import type { SuiNetwork } from "@/types/clusters";

export type TokenVerification = "verified" | "unverified" | "blocked";
export type TokenTrustSource = "protocol" | "deployment" | "trusted-list" | "user-import" | "discovered";

export type TokenDescriptor = {
  network: "sui";
  networkName?: SuiNetwork;
  coinType: string;
  symbol: string;
  name: string;
  decimals: number;
  verification: TokenVerification;
  trustSource?: TokenTrustSource;
  iconUrl?: string;
};

export type TokenMarketData = {
  symbol: string;
  priceUsd: number;
  change24h?: number;
  volume24hUsd?: number;
  liquidityUsd?: number;
  updatedAt: number;
};
