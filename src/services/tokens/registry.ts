import type { Token } from "@/services/quotes/types";

/**
 * UI bootstrap registry only. Balances and prices deliberately start at zero and
 * must be hydrated from the wallet/portfolio and pricing services.
 * Deployment-specific JARVIS/CCT coin types are resolved by the server APIs.
 */
export const TOKENS: Token[] = [
  {
    symbol: "SUI",
    name: "Sui",
    decimals: 9,
    verified: true,
    balance: 0,
    balanceText: "0",
    balanceBaseUnits: "0",
    priceUsd: 0,
    icon: "sui",
    coinType: "0x2::sui::SUI",
  },
  {
    symbol: "JARVIS",
    name: "Jarvis AI",
    decimals: 6,
    verified: false,
    balance: 0,
    balanceText: "0",
    balanceBaseUnits: "0",
    priceUsd: 0,
    icon: "jarvis",
  },
  {
    symbol: "CCT",
    name: "Carbon Credit Token",
    decimals: 6,
    verified: false,
    balance: 0,
    balanceText: "0",
    balanceBaseUnits: "0",
    priceUsd: 0,
    icon: "cct",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    verified: false,
    balance: 0,
    balanceText: "0",
    balanceBaseUnits: "0",
    priceUsd: 0,
    icon: "usdc",
  },
];
