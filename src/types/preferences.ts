export type PortfolioRange = "24H" | "7D" | "30D" | "90D";
export type UserPreferences = {
  fiatCurrency: "USD" | "EUR";
  hideSmallBalances: boolean;
  hideUnverifiedTokens: boolean;
  portfolioRange: PortfolioRange;
  transactionStatus: "all" | "submitted" | "confirmed" | "failed";
  tokenSort: "value" | "balance" | "symbol";
};
export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  fiatCurrency: "USD", hideSmallBalances: false, hideUnverifiedTokens: false,
  portfolioRange: "7D", transactionStatus: "all", tokenSort: "value",
};
