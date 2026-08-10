/// <reference types="next" />
/// <reference types="next/image-types/global" />

export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly CRON_SECRET?: string;
      NEXT_PUBLIC_SUI_NETWORK?: "mainnet" | "testnet" | "devnet";

      NEXT_PUBLIC_SUI_CLUSTER?: "mainnet" | "testnet" | "devnet" | "custom";
      NEXT_PUBLIC_SUI_CUSTOM_RPC_LABEL?: string;
      SUI_GRPC_URLS?: string;
      SUI_CUSTOM_GRPC_URL?: string;
      TRUSTED_TOKEN_COIN_TYPES?: string;
      NEXT_PUBLIC_REALTIME_WS_URL?: string;
      NEXT_PUBLIC_APP_URL?: string;
      NEXT_PUBLIC_SUPABASE_URL?: string;
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
      SUI_GRPC_URL?: string;
      JARVIS_REQUIRE_DEDICATED_RPC?: string;
      JARVIS_READINESS_REQUIRE_SWAP?: string;
      SUI_RPC_URLS?: string;
      SUI_RPC_FAILURE_THRESHOLD?: string;
      SUI_RPC_COOLDOWN_MS?: string;
      SUI_PROTECTED_RPC_URL?: string;
      DEEPBOOK_ENABLED?: string;
      DEEPBOOK_POOL_IDS?: string;
      JARVIS_SWAP_FEE_WALLET?: string;
      JARVIS_SUI_COIN_TYPE?: string;
      CCT_SUI_COIN_TYPE?: string;
      DATABASE_URL?: string;
      DIRECT_URL?: string;
      SUPABASE_SECRET_KEY?: string;
      JARVIS_QUOTE_SIGNING_SECRET?: string;
      JARVIS_REQUIRE_SIGNED_QUOTES?: string;
      JARVIS_REQUIRE_ONCHAIN_FEE?: string;
      JARVIS_SWAP_PACKAGE_ID?: string;
      JARVIS_SWAP_CONFIG_OBJECT_ID?: string;
      JARVIS_SESSION_SECRET?: string;
      JARVIS_REQUIRE_WALLET_SESSION?: string;
      JARVIS_SESSION_TTL_MS?: string;
      JARVIS_SESSION_CHALLENGE_TTL_MS?: string;
    }
  }
}
