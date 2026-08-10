"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWalletData, type WalletData } from "@/services/wallet/client";

export type WalletDataState = {
  data: WalletData | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  refreshedAt: number | null;
};

const REFRESH_INTERVAL_MS = 15_000;

export function useWalletData(address: string | null | undefined) {
  const [state, setState] = useState<WalletDataState>({ data: null, status: "idle", error: null, refreshedAt: null });
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (!address) {
      controller.current?.abort();
      setState({ data: null, status: "idle", error: null, refreshedAt: null });
      return null;
    }
    const id = ++requestId.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setState((current) => ({ ...current, status: current.data ? "ready" : "loading", error: null }));
    try {
      const data = await fetchWalletData(address, nextController.signal, force);
      if (id !== requestId.current || nextController.signal.aborted) return null;
      setState({ data, status: "ready", error: null, refreshedAt: Date.now() });
      return data;
    } catch (cause) {
      if (nextController.signal.aborted || id !== requestId.current) return null;
      const message = cause instanceof Error ? cause.message : "Unable to load wallet balances.";
      setState((current) => ({ ...current, status: "error", error: message }));
      return null;
    }
  }, [address]);

  useEffect(() => {
    void refresh(false);
    if (!address) return;
    const onRefresh = () => void refresh(true);
    const onVisibility = () => { if (document.visibilityState === "visible") void refresh(false); };
    const onOnline = () => void refresh(true);
    window.addEventListener("jarvis-swap:transaction-confirmed", onRefresh);
    window.addEventListener("jarvis-swap:realtime-wallet", onRefresh);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(false); }, REFRESH_INTERVAL_MS);
    return () => {
      controller.current?.abort();
      window.clearInterval(timer);
      window.removeEventListener("jarvis-swap:transaction-confirmed", onRefresh);
      window.removeEventListener("jarvis-swap:realtime-wallet", onRefresh);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [address, refresh]);

  return { ...state, refresh };
}
