import { NextResponse } from "next/server";
import { getServerConfig } from "@/config/env";
import { getSuiNetworkStatus } from "@/services/sui/rpc";
import { getRpcConfiguration } from "@/services/sui/rpc-config";
import { getGrpcReadHealth } from "@/services/sui/grpc";
import { preferredRpcEndpoint, rpcPoolHealthSummary } from "@/services/sui/rpc-health";
import { safeEndpointLabel } from "@/services/sui/rpc-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const config = getServerConfig();
    const [status, rpc] = await Promise.all([getSuiNetworkStatus(), Promise.resolve(getRpcConfiguration())]);
    const endpoints = config.grpcUrls.length ? config.grpcUrls : [config.grpcUrl];
    const preferred = preferredRpcEndpoint(endpoints);
    return NextResponse.json({ ok: true, network: config.network, cluster: rpc.cluster, clusterLabel: rpc.label, endpointCount: rpc.endpointCount, endpointLabels: rpc.endpoints, preferredReadEndpoint: preferred ? safeEndpointLabel(preferred) : undefined, rpcEndpointCount: config.rpcUrls.length, grpcConfigured: Boolean(config.grpcUrl), protectedExecution: rpc.protectedExecution, rpcHealth: getGrpcReadHealth(), rpcPool: rpcPoolHealthSummary(endpoints), checkedAt: Date.now(), ...status }, { headers: { "cache-control": "no-store" } });
  } catch (cause) {
    return NextResponse.json({ ok: false, error: cause instanceof Error ? cause.message : "Sui network unavailable." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
