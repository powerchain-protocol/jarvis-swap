"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { ToastProvider } from "@/components/shared/toast-provider";
import { RealtimeProvider } from "./realtime-context";
import { RpcProvider } from "./rpc-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <RpcProvider>
        <RealtimeProvider>
          <ToastProvider><WalletProvider>{children}</WalletProvider></ToastProvider>
        </RealtimeProvider>
      </RpcProvider>
    </ThemeProvider>
  );
}
