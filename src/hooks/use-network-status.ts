"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { API_ROUTES } from "@/constants";
import { fetchJson } from "@/common";
import type { NetworkStatus } from "@/types/rpc";

function parseNetworkStatus(value: unknown): NetworkStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Sui network status returned an invalid payload.");
  const record = value as Record<string, unknown>;
  const network = record.network;
  if (record.ok !== true || (network !== "mainnet" && network !== "testnet" && network !== "devnet")) {
    throw new Error(typeof record.error === "string" && record.error ? record.error : "Sui network is unavailable.");
  }
  const latencyMs = typeof record.latencyMs === "number" && Number.isFinite(record.latencyMs) && record.latencyMs >= 0 ? record.latencyMs : undefined;
  const rpcEndpointCount = typeof record.rpcEndpointCount === "number" && Number.isInteger(record.rpcEndpointCount) && record.rpcEndpointCount >= 0 ? record.rpcEndpointCount : undefined;
  const checkpoint = typeof record.checkpoint === "string" || typeof record.checkpoint === "number" ? record.checkpoint : undefined;
  const gasValue = record.referenceGasPrice ?? record.referenceGasPriceMIST;
  const referenceGasPrice = typeof gasValue === "string" || typeof gasValue === "number" ? gasValue : undefined;
  const cluster = record.cluster === "custom" || record.cluster === "mainnet" || record.cluster === "testnet" || record.cluster === "devnet" ? record.cluster : undefined;
  const endpointLabels = Array.isArray(record.endpointLabels) ? record.endpointLabels.filter((value): value is string => typeof value === "string").slice(0, 8) : undefined;
  const rpcHealth = Array.isArray(record.rpcHealth) ? record.rpcHealth.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    if (typeof item.host !== "string" || (item.state !== "available" && item.state !== "quarantined")) return [];
    return [{
      host: item.host.slice(0, 160),
      state: item.state as "available" | "quarantined",
      preferred: item.preferred === true,
      successes: typeof item.successes === "number" && Number.isInteger(item.successes) && item.successes >= 0 ? item.successes : 0,
      failures: typeof item.failures === "number" && Number.isInteger(item.failures) && item.failures >= 0 ? item.failures : 0,
      consecutiveFailures: typeof item.consecutiveFailures === "number" && Number.isInteger(item.consecutiveFailures) && item.consecutiveFailures >= 0 ? item.consecutiveFailures : 0,
      lastLatencyMs: typeof item.lastLatencyMs === "number" && Number.isFinite(item.lastLatencyMs) && item.lastLatencyMs >= 0 ? item.lastLatencyMs : undefined,
      ewmaLatencyMs: typeof item.ewmaLatencyMs === "number" && Number.isFinite(item.ewmaLatencyMs) && item.ewmaLatencyMs >= 0 ? item.ewmaLatencyMs : undefined,
      lastSuccessAt: typeof item.lastSuccessAt === "number" && Number.isFinite(item.lastSuccessAt) ? item.lastSuccessAt : undefined,
      lastFailureAt: typeof item.lastFailureAt === "number" && Number.isFinite(item.lastFailureAt) ? item.lastFailureAt : undefined,
      retryAfterMs: typeof item.retryAfterMs === "number" && Number.isFinite(item.retryAfterMs) && item.retryAfterMs >= 0 ? item.retryAfterMs : 0,
    }];
  }).slice(0, 8) : undefined;
  const rpcPoolRecord = record.rpcPool && typeof record.rpcPool === "object" && !Array.isArray(record.rpcPool) ? record.rpcPool as Record<string, unknown> : undefined;
  const rpcPool = rpcPoolRecord && ["cold", "healthy", "degraded", "critical"].includes(String(rpcPoolRecord.state)) ? {
    state: rpcPoolRecord.state as "cold" | "healthy" | "degraded" | "critical",
    endpointCount: typeof rpcPoolRecord.endpointCount === "number" && Number.isInteger(rpcPoolRecord.endpointCount) ? rpcPoolRecord.endpointCount : 0,
    healthyCount: typeof rpcPoolRecord.healthyCount === "number" && Number.isInteger(rpcPoolRecord.healthyCount) ? rpcPoolRecord.healthyCount : 0,
    quarantinedCount: typeof rpcPoolRecord.quarantinedCount === "number" && Number.isInteger(rpcPoolRecord.quarantinedCount) ? rpcPoolRecord.quarantinedCount : 0,
    observedCount: typeof rpcPoolRecord.observedCount === "number" && Number.isInteger(rpcPoolRecord.observedCount) ? rpcPoolRecord.observedCount : 0,
    preferredHost: typeof rpcPoolRecord.preferredHost === "string" ? rpcPoolRecord.preferredHost.slice(0, 160) : undefined,
    preferredLatencyMs: typeof rpcPoolRecord.preferredLatencyMs === "number" && Number.isFinite(rpcPoolRecord.preferredLatencyMs) && rpcPoolRecord.preferredLatencyMs >= 0 ? rpcPoolRecord.preferredLatencyMs : undefined,
  } : undefined;
  return {
    ok: true,
    network,
    cluster,
    clusterLabel: typeof record.clusterLabel === "string" ? record.clusterLabel : undefined,
    endpointCount: typeof record.endpointCount === "number" && Number.isInteger(record.endpointCount) ? record.endpointCount : undefined,
    endpointLabels,
    preferredReadEndpoint: typeof record.preferredReadEndpoint === "string" ? record.preferredReadEndpoint.slice(0, 160) : undefined,
    transport: typeof record.transport === "string" ? record.transport : undefined,
    checkpoint,
    referenceGasPrice,
    latencyMs,
    rpcEndpointCount,
    rpcHealth,
    rpcPool,
    chainId: typeof record.chainId === "string" ? record.chainId.slice(0, 160) : undefined,
    epoch: typeof record.epoch === "string" || typeof record.epoch === "number" ? record.epoch : undefined,
    checkedAt: typeof record.checkedAt === "number" && Number.isFinite(record.checkedAt) ? record.checkedAt : undefined,
  };
}

export function useNetworkStatus(refreshMs = 15_000) {
  const [data, setData] = useState<NetworkStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const activeController = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Browser is offline.");
      setLoading(false);
      return;
    }
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    try {
      const raw = await fetchJson<unknown>(API_ROUTES.networkStatus, { cache: "no-store", retries: 1, signal: controller.signal });
      const result = parseNetworkStatus(raw);
      if (controller.signal.aborted) return;
      setData(result);
      setError(null);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Unable to read Sui network status.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (activeController.current === controller) activeController.current = null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, refreshMs);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onOnline = () => void refresh();
    const onOffline = () => { activeController.current?.abort(); setError("Browser is offline."); setLoading(false); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      activeController.current?.abort();
    };
  }, [refresh, refreshMs]);

  return { data, error, loading, refresh };
}
