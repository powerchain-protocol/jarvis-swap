export type SuiNetwork = "mainnet" | "testnet" | "devnet";
export type WalletConnectionState = "disconnected" | "discovering" | "connecting" | "verifying" | "connected" | "error";
export type WalletDataState = "idle" | "loading" | "ready" | "stale" | "error";
export type WalletSummary = {
  address: string;
  network: SuiNetwork;
  provider?: string;
  connectedAt?: number;
  sessionVerified?: boolean;
};
export type WalletBalance = {
  coinType: string;
  symbol: string;
  balance: string;
  decimals: number;
  fetchedAt?: number;
};
