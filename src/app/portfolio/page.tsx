"use client";

import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useWallet } from "@/components/wallet/wallet-provider";
import { fetchPortfolioClient } from "@/services/portfolio/client";
import type { PortfolioAsset, PortfolioHistoryPoint, PortfolioSnapshot } from "@/types/portfolio";
import type { PortfolioRange } from "@/types/preferences";
import { usePreferences } from "@/hooks/use-preferences";
import { VirtualTokenList } from "@/components/tokens/virtual-token-list";
import { PortfolioAllocation } from "@/components/portfolio/portfolio-allocation";
import { PageState } from "@/components/shared/page-state";
import { formatFiatValue } from "@/utils/formats";
import ui from "../workspace.module.css";

const PortfolioChart = dynamic(() => import("@/components/portfolio/portfolio-chart").then((module) => module.PortfolioChart), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 190 }} aria-label="Loading portfolio chart" />,
});

const RANGE_MS: Record<PortfolioRange, number> = { "24H": 86_400_000, "7D": 604_800_000, "30D": 2_592_000_000, "90D": 7_776_000_000 };

export default function PortfolioPage() {
  const wallet = useWallet();
  const { preferences, setPreferences } = usePreferences();
  const [data, setData] = useState<PortfolioSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (force = false) => {
    const address = wallet.accountAddress;
    if (!address) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      setError("");
      const next = await fetchPortfolioClient(address, force);
      if (id === requestId.current) setData(next);
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Unable to load portfolio");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [wallet.accountAddress]);

  useEffect(() => {
    requestId.current += 1;
    setData(null);
    setError("");
    if (wallet.accountAddress) void load();
  }, [load, wallet.accountAddress]);

  useEffect(() => {
    let timer: number | null = null;
    const refresh = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(true), 250);
    };
    addEventListener("jarvis-swap:transaction-confirmed", refresh);
    addEventListener("jarvis-swap:realtime-wallet", refresh);
    addEventListener("jarvis-swap:realtime-prices", refresh);
    return () => {
      if (timer != null) window.clearTimeout(timer);
      removeEventListener("jarvis-swap:transaction-confirmed", refresh);
      removeEventListener("jarvis-swap:realtime-wallet", refresh);
      removeEventListener("jarvis-swap:realtime-prices", refresh);
    };
  }, [load]);

  const history = useMemo<PortfolioHistoryPoint[]>(() => {
    if (!data) return [];
    const cutoff = Date.now() - RANGE_MS[preferences.portfolioRange as PortfolioRange];
    return data.history.filter((point) => new Date(point.observedAt).getTime() >= cutoff);
  }, [data, preferences.portfolioRange]);

  const assets = useMemo<PortfolioAsset[]>(() => data?.assets.filter((asset) =>
    (!preferences.hideSmallBalances || (asset.valueUsd ?? 0) >= 1) &&
    (!preferences.hideUnverifiedTokens || asset.verified)
  ) ?? [], [data, preferences.hideSmallBalances, preferences.hideUnverifiedTokens]);

  return <div className="page-width">
    <div className="page-header">
      <div><h1 className="section-title">Portfolio</h1><p className="section-subtitle">Live Sui balances with freshness-aware pricing. Unpriced assets stay visible and are excluded from the portfolio total.</p></div>
      {wallet.accountAddress ? <div className="page-header-actions"><span className={ui.connectedPill}>Wallet connected</span><button className="button-secondary" disabled={loading} onClick={() => void load(true)}><RefreshCw size={15} />{loading ? "Refreshing" : "Refresh"}</button></div> : null}
    </div>

    {!wallet.accountAddress ? <PageState kind="empty" title="Connect your wallet" description="Connect a Sui wallet to load live balances, pricing, allocation, and portfolio history." /> : null}
    {wallet.accountAddress && !data && loading ? <PageState kind="loading" title="Building portfolio" description="Reading Sui balances and freshness-checked market prices." /> : null}
    {error ? <PageState kind="error" title="Portfolio unavailable" description={error} action={<button className="button-secondary" onClick={() => void load(true)}>Try again</button>} /> : null}
    {data ? <>
      <div className={ui.heroMetrics} aria-busy={loading}>
        <section className={`card ${ui.metricPrimary}`}><small>Total portfolio value</small><strong>{formatFiatValue(data.totalValueUsd)}</strong><span>{data.assets.length} discovered assets · freshness-checked market data</span></section>
        <section className={`card ${ui.metricSecondary}`}><small>Unpriced assets</small><strong>{data.unpricedAssetCount}</strong><span>Excluded from valuation</span></section>
      </div>

      <section className={`card ${ui.sectionCard}`}>
        <div className={ui.sectionHead}><div><h2>Portfolio history</h2><p>Historical valuations persisted from accepted price snapshots.</p></div><div className={ui.range}>{(["24H", "7D", "30D", "90D"] as const).map((range) => <button key={range} aria-pressed={preferences.portfolioRange === range} onClick={() => setPreferences({ portfolioRange: range })}>{range}</button>)}</div></div>
        {history.length > 1 ? <PortfolioChart points={history} /> : <PageState kind="empty" title="History is still building" description="Portfolio snapshots will appear here as fresh valuations are persisted." />}
      </section>

      <section className={`card ${ui.sectionCard}`}><div className={ui.sectionHead}><div><h2>Allocation</h2><p>Priced assets only; unknown valuations are intentionally excluded.</p></div></div><PortfolioAllocation assets={assets} /></section>

      <section className={`card ${ui.sectionCard}`}>
        <div className={ui.sectionHead}><div><h2>Assets</h2><p>{assets.length} visible · virtualized for large Sui wallets.</p></div></div>
        <div className={ui.filters}><label className={ui.check}><input type="checkbox" checked={preferences.hideSmallBalances} onChange={(event: ChangeEvent<HTMLInputElement>) => setPreferences({ hideSmallBalances: event.target.checked })} /> Hide balances under $1</label><label className={ui.check}><input type="checkbox" checked={preferences.hideUnverifiedTokens} onChange={(event: ChangeEvent<HTMLInputElement>) => setPreferences({ hideUnverifiedTokens: event.target.checked })} /> Verified tokens only</label></div>
        {assets.length ? <VirtualTokenList items={assets} /> : <PageState kind="empty" title="No assets match these filters" description="Adjust your portfolio filters to show more assets." />}
      </section>
    </> : null}
  </div>;
}
