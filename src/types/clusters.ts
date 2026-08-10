export const SUI_CLUSTERS = ["mainnet", "testnet", "devnet", "custom"] as const;
export type SuiCluster = (typeof SUI_CLUSTERS)[number];
export type SuiNetwork = "mainnet" | "testnet" | "devnet";

export type ClusterDescriptor = {
  id: SuiCluster;
  network: SuiNetwork;
  label: string;
  custom: boolean;
  grpcEndpoints: readonly string[];
  executionEndpointConfigured: boolean;
};
