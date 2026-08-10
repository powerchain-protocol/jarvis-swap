import "server-only";
import { getServerConfig } from "@/config/env";

export function safeEndpointLabel(raw: string) {
  try {
    const url = new URL(raw);
    return url.port ? `${url.hostname}:${url.port}` : url.hostname;
  } catch {
    return "invalid endpoint";
  }
}

export function getRpcConfiguration() {
  const config = getServerConfig();
  return {
    cluster: config.cluster,
    network: config.network,
    label: config.clusterLabel,
    endpointCount: config.grpcUrls.length,
    endpoints: config.grpcUrls.map(safeEndpointLabel),
    protectedExecution: Boolean(config.protectedRpcUrl),
    custom: config.cluster === "custom",
  } as const;
}
