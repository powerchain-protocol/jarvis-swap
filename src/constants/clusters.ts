import type { SuiCluster, SuiNetwork } from "@/types/clusters";

export const CLUSTER_LABELS: Record<SuiCluster, string> = {
  mainnet: "Sui Mainnet",
  testnet: "Sui Testnet",
  devnet: "Sui Devnet",
  custom: "Custom Sui RPC",
};

export function defaultClusterForNetwork(network: SuiNetwork): SuiCluster {
  return network;
}

export function clusterLabel(cluster: SuiCluster, network: SuiNetwork, customLabel?: string) {
  return cluster === "custom" ? (customLabel?.trim() || `Custom ${CLUSTER_LABELS[network]}`) : CLUSTER_LABELS[cluster];
}
