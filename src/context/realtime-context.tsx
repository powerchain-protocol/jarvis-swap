"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import type { RealtimeEnvelope, RealtimeState } from "@/types/realtime";

type RealtimeContextValue = {
  enabled: boolean;
  state: RealtimeState;
  message: RealtimeEnvelope | null;
  lastMessageAt: number | null;
  error: string | null;
  send: (data: unknown) => boolean;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const url = process.env.NEXT_PUBLIC_REALTIME_WS_URL?.trim();
  const realtime = useWebSocket(url, Boolean(url));
  useEffect(() => {
    const topic = realtime.message?.topic;
    if (!topic) return;
    if (["transactions","wallet","prices","pools"].includes(topic)) {
      window.dispatchEvent(new CustomEvent(`jarvis-swap:realtime-${topic}`, { detail: realtime.message }));
    }
  }, [realtime.message]);
  const value = useMemo<RealtimeContextValue>(() => ({
    enabled: Boolean(url),
    state: realtime.state,
    message: realtime.message,
    lastMessageAt: realtime.lastMessageAt,
    error: realtime.error,
    send: (data: unknown) => realtime.socket?.send(data) ?? false,
  }), [url, realtime.state, realtime.message, realtime.lastMessageAt, realtime.error, realtime.socket]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const value = useContext(RealtimeContext);
  if (!value) throw new Error("useRealtime must be used within RealtimeProvider.");
  return value;
}
