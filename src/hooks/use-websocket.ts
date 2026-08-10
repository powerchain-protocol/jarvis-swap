"use client";

import { useEffect, useMemo, useState } from "react";
import { RealtimeSocket } from "@/services/realtime/websocket";
import type { RealtimeConnectionInfo, RealtimeEnvelope } from "@/types/realtime";

const INITIAL: RealtimeConnectionInfo = { state: "idle", attempts: 0, lastConnectedAt: null, lastMessageAt: null, error: null };

export function useWebSocket(url: string | null | undefined, enabled = true) {
  const socket = useMemo(() => (url && enabled ? new RealtimeSocket({ url }) : null), [url, enabled]);
  const [info, setInfo] = useState<RealtimeConnectionInfo>(INITIAL);
  const [message, setMessage] = useState<RealtimeEnvelope | null>(null);

  useEffect(() => {
    if (!socket) {
      setInfo(INITIAL);
      return;
    }
    const offState = socket.onState(setInfo);
    const offMessage = socket.subscribe(setMessage);
    socket.connect();
    return () => {
      offState();
      offMessage();
      socket.close();
    };
  }, [socket]);

  return { socket, message, ...info };
}
