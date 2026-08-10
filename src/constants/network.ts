export const SUI_NETWORKS = ["mainnet", "testnet", "devnet"] as const;
export type PublicSuiNetwork = (typeof SUI_NETWORKS)[number];

export const DEFAULT_SUI_ENDPOINTS: Record<PublicSuiNetwork, { grpc: string; rpc: string; explorer: string }> = {
  mainnet: { grpc: "https://fullnode.mainnet.sui.io:443", rpc: "https://fullnode.mainnet.sui.io:443", explorer: "https://suiscan.xyz/mainnet" },
  testnet: { grpc: "https://fullnode.testnet.sui.io:443", rpc: "https://fullnode.testnet.sui.io:443", explorer: "https://suiscan.xyz/testnet" },
  devnet: { grpc: "https://fullnode.devnet.sui.io:443", rpc: "https://fullnode.devnet.sui.io:443", explorer: "https://suiscan.xyz/devnet" },
};

const candidate = process.env.NEXT_PUBLIC_SUI_NETWORK?.toLowerCase();
export const PUBLIC_SUI_NETWORK: PublicSuiNetwork = candidate === "testnet" || candidate === "devnet" ? candidate : "mainnet";

const clusterCandidate = process.env.NEXT_PUBLIC_SUI_CLUSTER?.toLowerCase();
export const PUBLIC_SUI_CLUSTER = clusterCandidate === "custom" || clusterCandidate === "testnet" || clusterCandidate === "devnet" || clusterCandidate === "mainnet" ? clusterCandidate : PUBLIC_SUI_NETWORK;
