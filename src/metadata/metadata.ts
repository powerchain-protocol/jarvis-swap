import type { SuiNetwork } from "@/types/clusters";
import type { TokenDescriptor } from "@/types/tokens";

export const JARVIS_SWAP_METADATA = {
  schemaVersion: 1,
  release: "1.0.0-rc.15",
  name: "JARVIS Swap",
  shortName: "JARVIS",
  description: "Non-custodial Sui swap, liquidity and portfolio workspace.",
  canonicalNetwork: "sui" as const,
  serviceFeeMaxBps: 250,
  serviceFeeMaxPercent: 2.5,
  capabilities: {
    swaps: true,
    portfolios: true,
    walletSessions: true,
    rpcFailover: true,
    trustedTokenRegistry: true,
  },
} as const;

export type TrustedTokenMetadata = TokenDescriptor & {
  networkName: SuiNetwork;
  source: "protocol" | "deployment";
  trusted: true;
};

export function toTrustedTokenMetadata(
  token: Omit<TrustedTokenMetadata, "trusted">,
): TrustedTokenMetadata {
  return { ...token, trusted: true };
}
