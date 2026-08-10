// Minimal checked-in database contract. Regenerate from Supabase after migrations with:
// pnpm supabase:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      jarvis_swap_wallets: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      jarvis_swap_tokens: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      jarvis_swap_token_prices: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      jarvis_swap_quotes: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      jarvis_swap_transactions: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      jarvis_swap_service_fees: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      jarvis_swap_liquidity_pools: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
      jarvis_swap_liquidity_positions: { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      Network: "mainnet" | "testnet" | "devnet";
      SwapStatus: "quoted" | "signed" | "submitted" | "confirmed" | "failed" | "expired";
      PriceProvider: "pyth" | "birdeye" | "coinmarketcap" | "coingecko";
    };
    CompositeTypes: Record<string, never>;
  };
};
