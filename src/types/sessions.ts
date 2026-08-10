export type WalletSession = {
  authenticated: boolean;
  configured: boolean;
  required: boolean;
  address?: string;
  network?: "mainnet" | "testnet" | "devnet";
  issuedAt?: number;
  expiresAt?: number;
};

export type WalletChallenge = {
  token: string;
  message: string;
  address: string;
  network: "mainnet" | "testnet" | "devnet";
  expiresAt: number;
};
