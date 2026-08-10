import { AggregatorClient, Env, getAllProviders } from "@cetusprotocol/aggregator-sdk";
import BN from "bn.js";
import { getServerConfig } from "@/config/env";
import { withCircuitBreaker } from "@/services/upstream/circuit-breaker";
import { AppError } from "@/utils/errors";
import { createHash } from "node:crypto";

type CetusRouter = NonNullable<Awaited<ReturnType<AggregatorClient["findRouters"]>>>;

type UnknownRecord = Record<string, unknown>;

export type CetusRouteQuote = {
  router: CetusRouter;
  quoteId: string;
  amountIn: bigint;
  amountOut: bigint;
  deviationRatio?: number;
  paths: string[];
  provider: string;
};

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" ? value as UnknownRecord : null;
}

function routePaths(router: CetusRouter): string[] {
  const source = record(router)?.paths;
  if (!Array.isArray(source)) return [];
  return source.map((item) => {
    const row = record(item);
    const value = row?.provider ?? row?.label;
    return typeof value === "string" && value.trim() ? value.trim() : "DEX";
  });
}

function optionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function requiredBigIntLike(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  const row = record(value);
  if (row && typeof row.toString === "function") {
    const text = String(row.toString());
    if (/^\d+$/.test(text)) return BigInt(text);
  }
  throw new AppError("UPSTREAM_ERROR", `Cetus returned an invalid ${field}.`);
}

function assertCetusNetworkSupported(network: "mainnet" | "testnet" | "devnet") {
  // Cetus Aggregator does not expose a Devnet environment. Mapping Devnet to
  // Testnet would risk constructing transactions against the wrong deployment.
  if (network === "devnet") {
    throw new AppError("CONFIGURATION_ERROR", "Cetus swap routing is not available on Sui Devnet. Use Testnet or Mainnet for swaps.");
  }
}


function normalizeProviderList(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isCetusTestnetProvider(provider: string) {
  const normalized = provider.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized.includes("cetus") || normalized.includes("deepbook");
}

function resolveProviders(requested: readonly string[] | undefined, configured: readonly string[], network: "mainnet" | "testnet" | "devnet") {
  const known = new Set(normalizeProviderList(getAllProviders()));
  const allowlist = normalizeProviderList(configured);
  const requestedList = normalizeProviderList(requested ?? []);
  const networkKnown = network === "testnet" ? [...known].filter(isCetusTestnetProvider) : [...known];

  const effective = requestedList.length ? requestedList : allowlist.length ? allowlist : networkKnown;
  if (!effective.length) throw new AppError("CONFIGURATION_ERROR", "No Cetus liquidity providers are available.");

  for (const provider of effective) {
    if (!known.has(provider)) {
      throw new AppError("BAD_REQUEST", `Unsupported Cetus provider: ${provider}.`);
    }
    if (network === "testnet" && !isCetusTestnetProvider(provider)) {
      throw new AppError("BAD_REQUEST", `Cetus Testnet routing only permits Cetus/DeepBook providers: ${provider}.`);
    }
    if (allowlist.length && !allowlist.includes(provider)) {
      throw new AppError("FORBIDDEN", `Cetus provider is not allowed by deployment policy: ${provider}.`);
    }
  }
  return effective;
}

function deterministicQuoteId(params: { from: string; target: string; amountIn: bigint; amountOut: bigint; paths: string[] }) {
  return createHash("sha256")
    .update([params.from, params.target, params.amountIn.toString(), params.amountOut.toString(), ...params.paths].join("\0"))
    .digest("hex");
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AppError("UPSTREAM_ERROR", message, { status: 504 })), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createCetusAggregator(signer?: string) {
  const config = getServerConfig();
  assertCetusNetworkSupported(config.network);
  return new AggregatorClient({
    endpoint: config.cetusEndpoint,
    signer,
    env: config.network === "mainnet" ? Env.Mainnet : Env.Testnet,
    pythUrls: config.pythUrls,
  });
}

export async function findCetusRoute(params: { from: string; target: string; amount: bigint; signer?: string; providers?: string[] }): Promise<CetusRouteQuote> {
  if (params.amount <= 0n) throw new AppError("BAD_REQUEST", "Cetus route amount must be positive.");
  const config = getServerConfig();
  const client = createCetusAggregator(params.signer);
  const providers = resolveProviders(params.providers, config.allowedCetusProviders, config.network);

  const router = await withCircuitBreaker("cetus-aggregator", async () => {
    return withTimeout(client.findRouters({
      from: params.from,
      target: params.target,
      amount: new BN(params.amount.toString()),
      byAmountIn: true,
      providers,
    }), config.cetusQuoteTimeoutMs, "Cetus quote timed out.");
  }, { failureThreshold: config.upstreamFailureThreshold, cooldownMs: config.upstreamCooldownMs });

  if (!router) throw new AppError("UPSTREAM_ERROR", "Cetus did not return a route for this pair.");
  const data = record(router);
  if (!data) throw new AppError("UPSTREAM_ERROR", "Cetus returned an invalid route payload.");
  if (data.insufficientLiquidity === true) throw new AppError("BAD_REQUEST", "Insufficient liquidity for this swap.", { status: 422 });

  const amountIn = requiredBigIntLike(data.amountIn, "input amount");
  const amountOut = requiredBigIntLike(data.amountOut, "output amount");
  if (amountIn <= 0n || amountOut <= 0n) throw new AppError("UPSTREAM_ERROR", "Cetus returned an invalid route amount.");
  if (amountIn !== params.amount) throw new AppError("UPSTREAM_ERROR", "Cetus returned an unexpected input amount for an exact-input quote.");

  const paths = routePaths(router);
  const quoteID = data?.quoteID;
  const quoteId = typeof quoteID === "string" && quoteID.trim()
    ? quoteID.trim().slice(0, 256)
    : deterministicQuoteId({ from: params.from, target: params.target, amountIn, amountOut, paths });
  const deviationRatio = optionalFiniteNumber(data?.deviationRatio);

  return {
    router,
    quoteId,
    amountIn,
    amountOut,
    deviationRatio,
    paths,
    provider: paths.length ? `Cetus Aggregator · ${[...new Set(paths)].join(" + ")}` : "Cetus Aggregator V3",
  };
}
