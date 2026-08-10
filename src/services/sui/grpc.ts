import "server-only";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { getServerConfig } from "@/config/env";
import { normalizeTransactionEntry } from "@/services/transactions/normalize";
import { asRecord, asString, normalizeSuiObject } from "@/services/sui/object-shapes";
import { recordRpcFailure, recordRpcSuccess, rpcEndpointHealthSnapshot, rankRpcEndpoints } from "@/services/sui/rpc-health";

const grpcClients = new Map<string, SuiGrpcClient>();
let cachedExecutionGrpcClient: { key: string; client: SuiGrpcClient } | undefined;
const networkIdentityCache = new Map<string, number>();
const chainIdByNetwork = new Map<string, string>();

function expectedNetworkName(network: "mainnet" | "testnet" | "devnet") {
  return network.toLowerCase();
}

function normalizeReportedNetwork(chain: string | null | undefined) {
  const value = chain?.trim().toLowerCase();
  if (!value) return undefined;
  const normalized = value.replace(/^sui[:_-]/, "");
  return ["mainnet", "testnet", "devnet"].includes(normalized) ? normalized : undefined;
}

export function assertReportedSuiNetwork(chain: string | null | undefined) {
  const config = getServerConfig();
  const reported = normalizeReportedNetwork(chain);
  const expected = expectedNetworkName(config.network);
  if (reported && reported !== expected) {
    throw new Error(`Sui gRPC network mismatch: configured ${expected}, provider reports ${reported}.`);
  }
}

function assertReportedChainId(chainId: string | null | undefined) {
  const config = getServerConfig();
  const value = chainId?.trim();
  if (!value) return;
  const key = config.network;
  const known = chainIdByNetwork.get(key);
  if (known && known !== value) {
    throw new Error(`Sui gRPC chain-id mismatch for ${config.network}.`);
  }
  chainIdByNetwork.set(key, value);
}

async function withGrpcTimeout<T>(operation: string, promise: Promise<T>, timeoutMs?: number): Promise<T> {
  const config = getServerConfig();
  const limit = timeoutMs ?? config.rpcTimeoutMs;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Sui gRPC ${operation} timed out after ${limit}ms.`)), limit);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Fail closed if a provider explicitly reports a different named Sui network. */
export async function assertSuiGrpcNetwork(force = false) {
  const config = getServerConfig();
  const key = `${config.network}:${config.grpcUrl}`;
  const checkedAt = networkIdentityCache.get(key);
  if (!force && checkedAt && Date.now() - checkedAt < 30_000) return;
  // Transaction simulation must validate the exact primary endpoint used for the
  // transaction path; a healthy fallback read endpoint must never bless it.
  await assertGrpcClientNetwork(createSuiGrpcClient(config.grpcUrl), key);
}

/** Reuse the Sui gRPC client within a server process. Recreating the transport for
 * every balance/quote/status request adds connection churn and avoidable latency.
 * The cache key includes both network and endpoint so environment/profile changes
 * cannot accidentally reuse a client for another chain.
 */
export function createSuiGrpcClient(baseUrl?: string) {
  const config = getServerConfig();
  const endpoint = baseUrl ?? config.grpcUrl;
  const key = `${config.network}:${endpoint}`;
  const cached = grpcClients.get(key);
  if (cached) return cached;
  const client = new SuiGrpcClient({ network: config.network, baseUrl: endpoint });
  grpcClients.set(key, client);
  return client;
}

async function withGrpcReadFailover<T>(operation: string, run: (client: SuiGrpcClient) => Promise<T>): Promise<T> {
  const config = getServerConfig();
  const endpoints = config.grpcUrls.length ? config.grpcUrls : [config.grpcUrl];
  // Healthy low-latency endpoints rise to the front, while quarantined endpoints
  // remain last-resort probes so the pool can recover without a process restart.
  const candidates = rankRpcEndpoints(endpoints);
  let lastError: unknown;
  for (const endpoint of candidates) {
    const client = createSuiGrpcClient(endpoint);
    const startedAt = Date.now();
    try {
      await assertGrpcClientNetwork(client, `${config.network}:${endpoint}`);
      const result = await withGrpcTimeout(operation, run(client));
      recordRpcSuccess(endpoint, Date.now() - startedAt);
      return result;
    } catch (cause) {
      recordRpcFailure(endpoint, cause, config.rpcFailureThreshold, config.rpcCooldownMs);
      lastError = cause;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Sui gRPC ${operation} failed on all configured endpoints.`);
}

export function getGrpcReadHealth() {
  const config = getServerConfig();
  return rpcEndpointHealthSnapshot(config.grpcUrls.length ? config.grpcUrls : [config.grpcUrl]);
}

/** Submission client. When a deployment configures SUI_PROTECTED_RPC_URL it must
 * be a Sui gRPC-compatible endpoint and is used only for transaction submission. */
export function createSuiExecutionGrpcClient() {
  const config = getServerConfig();
  const baseUrl = config.protectedRpcUrl ?? config.grpcUrl;
  const key = `${config.network}:${baseUrl}`;
  if (cachedExecutionGrpcClient?.key === key) return cachedExecutionGrpcClient.client;
  const client = new SuiGrpcClient({ network: config.network, baseUrl });
  cachedExecutionGrpcClient = { key, client };
  return client;
}

async function assertGrpcClientNetwork(client: SuiGrpcClient, endpointKey: string) {
  const checkedAt = networkIdentityCache.get(endpointKey);
  if (checkedAt && Date.now() - checkedAt < 30_000) return;
  const outer = asRecord(await withGrpcTimeout("getServiceInfo", client.ledgerService.getServiceInfo({}))) ?? {};
  const response = asRecord(outer.response) ?? outer;
  assertReportedSuiNetwork(asString(response.chain));
  assertReportedChainId(asString(response.chainId));
  networkIdentityCache.set(endpointKey, Date.now());
}

export async function listBalancesGrpc(owner: string) {
  const result = asRecord(await withGrpcReadFailover("listBalances", (client) => client.core.listBalances({ owner }))) ?? {};
  const balances = Array.isArray(result.balances) ? result.balances : [];
  return balances.map((value) => {
    const balance = asRecord(value) ?? {};
    return {
      coinType: asString(balance.coinType) ?? "",
      totalBalance: asString(balance.balance) ?? "0",
      coinBalance: asString(balance.coinBalance) ?? undefined,
      addressBalance: asString(balance.addressBalance) ?? undefined,
      coinObjectCount: 0,
    };
  }).filter((balance) => Boolean(balance.coinType));
}

export async function getCoinMetadataGrpc(coinType: string) {
  const result = asRecord(await withGrpcReadFailover("getCoinMetadata", (client) => client.core.getCoinMetadata({ coinType }))) ?? {};
  return result.coinMetadata ?? null;
}

export async function getServiceInfoGrpc() {
  const outer = asRecord(await withGrpcReadFailover("getServiceInfo", (client) => client.ledgerService.getServiceInfo({}))) ?? {};
  const response = asRecord(outer.response) ?? outer;
  return {
    chain: asString(response.chain),
    chainId: asString(response.chainId),
    checkpointHeight: asString(response.checkpointHeight) ?? "",
    epoch: asString(response.epoch) ?? "",
  };
}

export async function getReferenceGasPriceGrpc() {
  const result = asRecord(await withGrpcReadFailover("getReferenceGasPrice", (client) => client.core.getReferenceGasPrice())) ?? {};
  const gasPrice = asString(result.referenceGasPrice);
  if (!gasPrice || !/^\d+$/.test(gasPrice)) throw new Error("Sui gRPC returned an invalid reference gas price.");
  return gasPrice;
}

export async function waitForTransactionGrpc(digest: string) {
  const config = getServerConfig();
  const result = await withGrpcReadFailover("waitForTransaction", (client) => client.core.waitForTransaction({
    digest,
    timeout: config.transactionWaitTimeoutMs,
    include: { effects: true, balanceChanges: true, events: true },
  }));
  return result;
}


export async function listTransactionsBySenderGrpc(sender: string, limit = 25, before?: string | null, after?: string | null) {
  const result = await withGrpcReadFailover("listTransactions", (client) => client.core.listTransactions({
    filter: { sender },
    order: after ? "ascending" : "descending",
    limit,
    ...(before ? { before } : {}),
    ...(after ? { after } : {}),
    include: { effects: true, balanceChanges: true, events: true, transaction: true },
  }));
  const page = asRecord(result) ?? {};
  const transactions = Array.isArray(page.transactions) ? page.transactions : [];
  return {
    transactions: transactions.map(normalizeTransactionEntry).filter((tx: { digest: string }) => Boolean(tx.digest)),
    startCursor: asString(page.startCursor),
    endCursor: asString(page.endCursor),
    hasNextPage: page.hasNextPage === true,
  };
}

export async function getTransactionGrpc(digest: string) {
  const result = await withGrpcReadFailover("getTransaction", (client) => client.core.getTransaction({
    digest,
    include: { effects: true, balanceChanges: true, events: true, transaction: true },
  }));
  return normalizeTransactionEntry(result);
}

export async function listOwnedObjectsGrpc(owner: string, type: string, limit = 50) {
  const result = await withGrpcReadFailover("listOwnedObjects", (client) => client.core.listOwnedObjects({
    owner,
    type,
    limit,
    include: { json: true, display: true, previousTransaction: true },
  }));
  const page = asRecord(result) ?? {};
  const objects = Array.isArray(page.objects) ? page.objects : [];
  return {
    objects: objects.map((object) => normalizeSuiObject(object)),
    cursor: asString(page.cursor),
    hasNextPage: page.hasNextPage === true,
  };
}

export async function getObjectsGrpc(objectIds: string[]) {
  const result = await withGrpcReadFailover("getObjects", (client) => client.core.getObjects({
    objectIds,
    include: { json: true, display: true, previousTransaction: true },
  }));
  const page = asRecord(result) ?? {};
  const objects = Array.isArray(page.objects) ? page.objects : [];
  return objects.map((object, index) => normalizeSuiObject(object, objectIds[index]));
}

export async function simulateTransactionGrpc(transaction: Uint8Array) {
  const client = createSuiGrpcClient();
  await assertSuiGrpcNetwork();
  return withGrpcTimeout("simulateTransaction", client.core.simulateTransaction({
    transaction,
    include: { effects: true, balanceChanges: true, events: true, objectTypes: true, transaction: true, commandResults: true },
  }));
}

export async function executeTransactionGrpc(transaction: Uint8Array, signature: string) {
  const config = getServerConfig();
  const client = createSuiExecutionGrpcClient();
  const endpoint = config.protectedRpcUrl ?? config.grpcUrl;
  await assertGrpcClientNetwork(client, `${config.network}:${endpoint}`);
  return withGrpcTimeout("executeTransaction", client.core.executeTransaction({
    transaction,
    signatures: [signature],
    include: { effects: true, balanceChanges: true, events: true, objectTypes: true, transaction: true },
  }));
}
