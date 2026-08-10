"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { PUBLIC_SUI_NETWORK } from "@/constants";

type RpcContextValue = ReturnType<typeof useNetworkStatus> & { network: typeof PUBLIC_SUI_NETWORK };
const RpcContext = createContext<RpcContextValue | null>(null);

export function RpcProvider({ children }: { children: ReactNode }) {
  const status = useNetworkStatus();
  const value = useMemo(() => ({ ...status, network: PUBLIC_SUI_NETWORK }), [status]);
  return <RpcContext.Provider value={value}>{children}</RpcContext.Provider>;
}

export function useRpc() {
  const value = useContext(RpcContext);
  if (!value) throw new Error("useRpc must be used within RpcProvider.");
  return value;
}
