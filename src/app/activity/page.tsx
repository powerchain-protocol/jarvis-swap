"use client";

import { ArrowLeftRight, Clock3, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PUBLIC_SUI_NETWORK } from "@/constants/network";
import styles from "@/components/shared/market.module.css";
import { PageState } from "@/components/shared/page-state";
import { explorerUrl, readSwapActivity, type SwapActivity } from "@/services/transactions/history";
import { fetchWalletActivity } from "@/services/transactions/client";
import { TransactionFilters, type TxFilters } from "@/components/activity/transaction-filters";
import { useWallet } from "@/components/wallet/wallet-provider";
import type { NormalizedTransaction } from "@/types/transactions";
import { baseUnitsToDecimalString } from "@/services/fees/service-fee";
import { formatTokenAmount } from "@/utils/formats";

const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
function shortCoin(type: string) { return type.split("::").at(-1) || "Token"; }
function formatGas(mist?: string | null) {
  if (!mist || !/^\d+$/.test(mist)) return "—";
  return `${formatTokenAmount(baseUnitsToDecimalString(BigInt(mist), 9), 6)} SUI`;
}

export default function ActivityPage() {
  const wallet = useWallet();
  const [local, setLocal] = useState<SwapActivity[]>([]);
  const [chain, setChain] = useState<NormalizedTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<TxFilters>({ status: "all", query: "" });
  const requestId = useRef(0);
  const network = PUBLIC_SUI_NETWORK;

  const load = useCallback(async (reset = true) => {
    const address = wallet.accountAddress;
    if (!address) return;
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const page = await fetchWalletActivity(address, { before: reset ? null : cursor, limit: 25 });
      if (id !== requestId.current) return;
      setChain((current) => reset ? page.transactions : [...current, ...page.transactions.filter((next) => !current.some((existing) => existing.digest === next.digest))]);
      setCursor(page.endCursor);
      setHasMore(page.hasNextPage);
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Unable to load on-chain activity");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [cursor, wallet.accountAddress]);

  useEffect(() => {
    const refresh = () => setLocal(readSwapActivity());
    refresh();
    addEventListener("storage", refresh);
    addEventListener("jarvis-swap:activity-updated", refresh);
    return () => {
      removeEventListener("storage", refresh);
      removeEventListener("jarvis-swap:activity-updated", refresh);
    };
  }, []);

  useEffect(() => {
    requestId.current += 1;
    setChain([]);
    setCursor(null);
    setHasMore(false);
    if (wallet.accountAddress) void load(true);
  // Reload specifically when the connected account changes; `load` also closes over pagination state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.accountAddress]);

  useEffect(() => {
    const refresh = () => void load(true);
    addEventListener("jarvis-swap:transaction-confirmed", refresh);
    addEventListener("jarvis-swap:realtime-transactions", refresh);
    return () => {
      removeEventListener("jarvis-swap:transaction-confirmed", refresh);
      removeEventListener("jarvis-swap:realtime-transactions", refresh);
    };
  }, [load]);

  const shown = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return chain.filter((transaction) => {
      const statusMatches = filters.status === "all"
        || (filters.status === "confirmed" && transaction.status === "success")
        || (filters.status === "failed" && transaction.status === "failure");
      if (!statusMatches) return false;
      if (!query) return true;
      return `${transaction.digest} ${transaction.balanceChanges.map((change) => change.coinType).join(" ")}`.toLowerCase().includes(query);
    });
  }, [chain, filters]);

  return (
    <div className="page-width">
      <div className="page-header">
        <div><h1 className="section-title">Recent Activity</h1><p className="section-subtitle">Live Sui transaction history with cursor pagination. Local records are used only as a temporary UX cache.</p></div>
        <button className="button-secondary" disabled={!wallet.accountAddress || loading} onClick={() => void load(true)}><RefreshCw size={16} /> {loading ? "Refreshing" : "Refresh"}</button>
      </div>
      <TransactionFilters value={filters} onChange={setFilters} />
      {error ? <PageState kind="error" title="Activity unavailable" description={error} action={<button className="button-secondary" onClick={() => void load(true)}>Try again</button>} /> : null}
      <div className={styles.activityList} aria-busy={loading}>
        {wallet.accountAddress && !shown.length && loading ? <PageState kind="loading" title="Loading transactions" description="Reading recent activity from the configured Sui network." /> : null}
        {wallet.accountAddress && !shown.length && !loading && !error ? <PageState kind="empty" title="No matching transactions" description="Adjust the filters or submit a transaction to see activity here." /> : null}
        {shown.map((item) => {
          const outs = item.balanceChanges.filter((change) => change.direction === "out");
          const ins = item.balanceChanges.filter((change) => change.direction === "in");
          return (
            <section className={`card ${styles.activityCard}`} key={item.digest}>
              <div className={styles.activityIcon}><ArrowLeftRight size={18} /></div>
              <div><strong>{outs[0] ? shortCoin(outs[0].coinType) : "Transaction"} → {ins[0] ? shortCoin(ins[0].coinType) : "Sui"}</strong><small className={styles.activityMeta}>{item.timestampMs ? DATE.format(new Date(item.timestampMs)) : "Pending timestamp"}</small></div>
              <div><small>Balance changes</small><strong className={styles.activityValue}>{item.balanceChanges.length}</strong></div>
              <div><small>Gas</small><strong className={styles.activityValue}>{formatGas(item.gasUsedMist)}</strong><span className={styles.status} data-status={item.status}>{item.status === "success" ? "Confirmed" : "Failed"}</span></div>
              <a className={styles.explorer} href={explorerUrl(network, item.digest)} target="_blank" rel="noreferrer">View on explorer ↗</a>
            </section>
          );
        })}
      </div>
      {wallet.accountAddress && hasMore ? <div className={styles.loadMore}><button className="button-secondary" disabled={loading} onClick={() => void load(false)}>{loading ? "Loading…" : "Load older"}</button></div> : null}
      {!wallet.accountAddress ? <PageState kind="empty" title="Connect your wallet" description="Connect a Sui wallet to load its on-chain transaction history." /> : null}
      {local.length > 0 ? <details className={styles.localRecords}><summary>Wallet-local swap records ({local.length})</summary><p>Local records are optimistic UX state and are never authoritative over Sui finality.</p></details> : null}
    </div>
  );
}
