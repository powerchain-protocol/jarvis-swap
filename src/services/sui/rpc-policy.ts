import "server-only";

import { AppError } from "@/utils/errors";

const PUBLIC_GOOD_HOSTS = new Set([
  "fullnode.mainnet.sui.io",
  "fullnode.testnet.sui.io",
  "fullnode.devnet.sui.io",
]);

export function rpcHostname(endpoint: string) {
  try { return new URL(endpoint).hostname.toLowerCase(); }
  catch { return "invalid"; }
}

export function isPublicGoodSuiEndpoint(endpoint: string) {
  return PUBLIC_GOOD_HOSTS.has(rpcHostname(endpoint));
}

export function dedicatedRpcViolations(input: {
  network: "mainnet" | "testnet" | "devnet";
  requireDedicated: boolean;
  grpcUrls: readonly string[];
  protectedRpcUrl?: string;
}) {
  if (!input.requireDedicated || input.network !== "mainnet") return [] as string[];
  const publicReads = input.grpcUrls.filter(isPublicGoodSuiEndpoint);
  const violations: string[] = [];
  if (publicReads.length) {
    violations.push(`Dedicated Mainnet RPC is required, but ${publicReads.length} public-good Sui endpoint${publicReads.length === 1 ? " is" : "s are"} still configured in the read pool.`);
  }
  if (input.protectedRpcUrl && isPublicGoodSuiEndpoint(input.protectedRpcUrl)) {
    violations.push("Protected Mainnet submission endpoint must not use a Sui public-good fullnode when dedicated RPC is required.");
  }
  return violations;
}

export function assertDedicatedRpcPolicy(input: Parameters<typeof dedicatedRpcViolations>[0]) {
  const violations = dedicatedRpcViolations(input);
  if (violations.length) throw new AppError("CONFIGURATION_ERROR", violations.join(" "));
}
