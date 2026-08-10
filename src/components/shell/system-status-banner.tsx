"use client";

import { CircleAlert, CloudOff, RefreshCw } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useRpc } from "@/context/rpc-context";
import styles from "./shell.module.css";

export function SystemStatusBanner() {
  const online = useOnlineStatus();
  const { error, loading, refresh } = useRpc();

  if (online && (!error || loading)) return null;

  const offline = !online;
  return (
    <div className={styles.systemBanner} data-kind={offline ? "offline" : "degraded"} role="status" aria-live="polite">
      <span className={styles.systemBannerIcon}>{offline ? <CloudOff size={16} /> : <CircleAlert size={16} />}</span>
      <div className={styles.systemBannerCopy}>
        <strong>{offline ? "You’re offline" : "Sui network connection is degraded"}</strong>
        <span>{offline ? "Quotes and transactions are paused until your connection returns." : "Live balances, quotes, or confirmations may be delayed. No transaction will be treated as confirmed without Sui finality."}</span>
      </div>
      {!offline && <button type="button" onClick={() => void refresh()} aria-label="Retry Sui network status"><RefreshCw size={15} />Retry</button>}
    </div>
  );
}
