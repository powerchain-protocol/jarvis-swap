import "server-only";
import { getServerConfig } from "@/config/env";
import { assertReportedSuiNetwork, getReferenceGasPriceGrpc, getServiceInfoGrpc } from "@/services/sui/grpc";

/**
 * JSON-RPC compatibility helper for third-party endpoints only.
 * New JARVIS application reads use Sui gRPC/Core. Foundation mainnet JSON-RPC
 * is deprecated/disabled, so readiness and network health never depend on this helper.
 */
export type JsonRpcError = { code: number; message: string; data?: unknown };
export type JsonRpcResponse<T> = { jsonrpc: "2.0"; id: number; result?: T; error?: JsonRpcError };
let rpcId = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function suiRpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const config = getServerConfig();
  if (!config.rpcUrls.length) throw new Error("No Sui JSON-RPC compatibility endpoint is configured.");
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.rpcRetries; attempt += 1) {
    const url = config.rpcUrls[attempt % config.rpcUrls.length];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.rpcTimeoutMs);
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }), cache: "no-store", signal: controller.signal });
      if (response.status === 429 || response.status >= 500) throw new Error(`Sui RPC ${response.status} from ${new URL(url).host}.`);
      if (!response.ok) throw new Error(`Sui RPC request failed with HTTP ${response.status}.`);
      const payload = await response.json() as JsonRpcResponse<T>;
      if (payload.error) throw new Error(`Sui RPC ${payload.error.code}: ${payload.error.message}`);
      if (payload.result === undefined) throw new Error(`Sui RPC ${method} returned no result.`);
      return payload.result;
    } catch (cause) {
      lastError = cause;
      if (attempt < config.rpcRetries) await sleep(Math.min(250 * 2 ** attempt, 2_000));
    } finally { clearTimeout(timeout); }
  }
  throw lastError instanceof Error ? lastError : new Error(`Sui RPC ${method} failed.`);
}

export async function getSuiNetworkStatus() {
  const startedAt = Date.now();
  const [service, gasPrice] = await Promise.all([getServiceInfoGrpc(), getReferenceGasPriceGrpc()]);
  assertReportedSuiNetwork(service.chain);
  return {
    checkpoint: service.checkpointHeight,
    epoch: service.epoch,
    chainId: service.chainId,
    chain: service.chain,
    referenceGasPriceMIST: gasPrice,
    latencyMs: Date.now() - startedAt,
    transport: "grpc" as const,
  };
}
