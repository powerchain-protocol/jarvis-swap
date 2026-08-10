export type Token = {
  symbol: string;
  name: string;
  decimals: number;
  verified: boolean;
  /** Presentation-only numeric balance. Prefer balanceText/base units for spend validation. */
  balance: number;
  /** Exact decimal wallet balance, when hydrated from Sui. */
  balanceText?: string;
  /** Exact base-unit wallet balance, when hydrated from Sui. */
  balanceBaseUnits?: string;
  priceUsd: number;
  icon?: "jarvis" | "sui" | "usdc" | "cct";
  coinType?: string;
};

import type { RoutingPreference } from "@/config/settings";
export type { RoutingPreference } from "@/config/settings";

export type QuoteRequest = {
  amountIn: string;
  pay: Token;
  receive: Token;
  slippageBps: number;
  routing: RoutingPreference;
  maxPriceImpactBps: number;
  deadlineMinutes: number;
};

export type Quote = {
  id: string;
  network: "mainnet" | "testnet" | "devnet";
  mode: "live";
  amountOut: number;
  amountOutText: string;
  amountOutBaseUnits: string;
  routeCommitment: string;
  policyFingerprint: string;
  minimumAmountOutBaseUnits: string;
  grossAmountInBaseUnits: string;
  netSwapAmountBaseUnits: string;
  serviceFeeBaseUnits: string;
  serviceFeeAmount: number;
  serviceFeeAmountText: string;
  serviceFeeBps: number;
  serviceFeeRecipient?: string;
  maxPriceImpactBps?: number;
  priceImpactBps: number;
  routing: RoutingPreference;
  deadlineMinutes: number;
  issuedAt: number;
  signature?: string;
  signed?: boolean;
  rate: number;
  priceImpact: number;
  minimumReceived: number;
  minimumReceivedText: string;
  networkFee: number | null;
  route: string[];
  provider: string;
  payCoinType: string;
  receiveCoinType: string;
  payDecimals: number;
  receiveDecimals: number;
  expiresAt: number;
};
