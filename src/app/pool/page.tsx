"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronRight, CircleAlert, Droplets, RefreshCw, ShieldCheck } from "lucide-react";
import { JarvisTokenIcon } from "@/components/branding/logo";
import { useWallet } from "@/components/wallet/wallet-provider";
import { formatInteger, shortenAddress } from "@/utils/formats";
import styles from "@/components/shared/market.module.css";
import type { PoolPosition } from "@/types/pools";

type Pool = {
  id: string; exists: boolean; type: string | null; version: string | null;
  coinTypeA: string | null; coinTypeB: string | null; feeRate: string | null;
  tickSpacing?: string | null; currentTickIndex?: number | null; currentSqrtPrice: string | null; liquidity: string | null;
};
type PoolStatus = { network: string; provider: string; configured: boolean; pools: Pool[]; error?: string };
type PositionResponse = { ok: boolean; configured: boolean; positions: PoolPosition[]; totals?: { positions: number; inRange: number; outOfRange: number; unknownRange: number }; error?: string };

export default function PoolPage() {
  const { accountAddress } = useWallet();
  const [tab, setTab] = useState<"pools" | "positions">("pools");
  const [status, setStatus] = useState<PoolStatus | null>(null);
  const [positions, setPositions] = useState<PositionResponse | null>(null);
  const [loadingPools, setLoadingPools] = useState(true);
  const [loadingPositions, setLoadingPositions] = useState(false);

  async function refreshPools(signal?: AbortSignal) {
    setLoadingPools(true);
    try {
      const response = await fetch("/api/v1/pools", { cache: "no-store", signal });
      const body = await response.json() as PoolStatus;
      setStatus(response.ok ? body : { ...body, configured: false, pools: [] });
    } catch (cause) {
      if (!signal?.aborted) setStatus({ network: "unknown", provider: "Cetus CLMM", configured: false, pools: [], error: cause instanceof Error ? cause.message : "Pool status unavailable" });
    } finally { if (!signal?.aborted) setLoadingPools(false); }
  }

  async function refreshPositions(signal?: AbortSignal) {
    if (!accountAddress) { setPositions(null); return; }
    setLoadingPositions(true);
    try {
      const response = await fetch(`/api/v1/pools/positions?owner=${encodeURIComponent(accountAddress)}`, { cache: "no-store", signal });
      const body = await response.json() as PositionResponse;
      if (!signal?.aborted) setPositions(body);
    } catch (cause) {
      if (!signal?.aborted) setPositions({ ok: false, configured: false, positions: [], error: cause instanceof Error ? cause.message : "Positions unavailable" });
    } finally { if (!signal?.aborted) setLoadingPositions(false); }
  }

  useEffect(() => { const controller = new AbortController(); void refreshPools(controller.signal); return () => controller.abort(); }, []);
  useEffect(() => { const controller = new AbortController(); void refreshPositions(controller.signal); return () => controller.abort(); }, [accountAddress]);
  useEffect(() => {
    const handler = () => { void refreshPools(); void refreshPositions(); };
    window.addEventListener("jarvis-swap:realtime-pools", handler);
    window.addEventListener("jarvis-swap:transaction-confirmed", handler);
    return () => { window.removeEventListener("jarvis-swap:realtime-pools", handler); window.removeEventListener("jarvis-swap:transaction-confirmed", handler); };
  }, [accountAddress]);

  const livePools = useMemo(() => status?.pools.filter((pool) => pool.exists) ?? [], [status]);
  const totals = positions?.totals;

  return (
    <div className="center-card">
      <div className="page-header">
        <div>
          <h1 className="section-title">Liquidity</h1>
          <p className="section-subtitle">Cetus concentrated-liquidity pools and wallet-owned positions on Sui.</p>
        </div>
        <div className="page-header-actions">
          <button className="button-secondary" onClick={() => { void refreshPools(); void refreshPositions(); }} disabled={loadingPools || loadingPositions}>
            <RefreshCw size={15} aria-hidden="true" /> Refresh
          </button>
          <button className="button-primary" disabled={!status?.configured}>Add liquidity</button>
        </div>
      </div>

      <div className={styles.poolTabs} role="tablist" aria-label="Liquidity views">
        <button className={tab === "pools" ? styles.active : ""} onClick={() => setTab("pools")} role="tab" aria-selected={tab === "pools"}>Explore Pools</button>
        <button className={tab === "positions" ? styles.active : ""} onClick={() => setTab("positions")} role="tab" aria-selected={tab === "positions"}>My Positions{totals ? ` · ${totals.positions}` : ""}</button>
      </div>

      {tab === "pools" ? (
        <div className={styles.poolGrid}>
          {loadingPools && !status ? <PoolSkeleton /> : null}
          {!loadingPools && !status?.configured ? (
            <section className={`card ${styles.emptyState}`}>
              <CircleAlert size={24} />
              <strong>Cetus pool registry is not configured</strong>
              <span>Set audited pool object IDs in <code>CETUS_POOL_IDS</code>. JARVIS does not guess production pool addresses.</span>
            </section>
          ) : null}
          {livePools.map((pool) => <PoolCard key={pool.id} pool={pool} network={status?.network ?? "sui"} />)}
          {status?.error ? <p className="muted">{status.error}</p> : null}
        </div>
      ) : (
        <section className={styles.positionsSection}>
          {!accountAddress ? (
            <div className={`card ${styles.emptyState}`}><Droplets size={24} /><strong>Connect a Sui wallet</strong><span>Your wallet-owned Cetus positions will appear here.</span></div>
          ) : !positions?.configured && !loadingPositions ? (
            <div className={`card ${styles.emptyState}`}><CircleAlert size={24} /><strong>Position type not configured</strong><span>Set <code>CETUS_POSITION_OBJECT_TYPE</code> to enable verified on-chain position discovery.</span></div>
          ) : (
            <>
              <div className={styles.positionMetrics}>
                <Metric label="Positions" value={String(totals?.positions ?? positions?.positions.length ?? 0)} />
                <Metric label="In range" value={String(totals?.inRange ?? 0)} tone="success" />
                <Metric label="Out of range" value={String(totals?.outOfRange ?? 0)} tone="warning" />
                <Metric label="Range unknown" value={String(totals?.unknownRange ?? 0)} />
              </div>
              {loadingPositions && !positions ? <PoolSkeleton /> : null}
              <div className={styles.positionList}>
                {(positions?.positions ?? []).map((position) => <PositionCard key={position.objectId} position={position} />)}
              </div>
              {!loadingPositions && positions?.positions.length === 0 ? <div className={`card ${styles.emptyState}`}><Droplets size={24} /><strong>No Cetus positions found</strong><span>No matching CLMM position objects were found for this wallet.</span></div> : null}
              {positions?.error ? <p className="muted">{positions.error}</p> : null}
            </>
          )}
        </section>
      )}

      <section className={`card ${styles.lpSafety}`}>
        <ShieldCheck size={19} />
        <div><strong>Liquidity execution is fail-closed</strong><p>Discovery and accounting are live. Open/add/remove/collect/close transaction builders stay disabled until the audited Cetus SDK adapter and exact pool parameters are configured.</p></div>
      </section>
    </div>
  );
}

function PoolCard({ pool, network }: { pool: Pool; network: string }) {
  return <section className={`card ${styles.poolCard}`}>
    <div className={styles.poolHead}>
      <div className={styles.pairIdentity}><div className={styles.pairIcons}><span className={styles.pairIcon}>S</span><JarvisTokenIcon size={34} /></div><div><strong>SUI / JARVIS</strong><div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Cetus CLMM · {network}</div></div></div>
      <span className={styles.tag}>On-chain</span>
    </div>
    <div className={styles.poolStats}>
      <Metric label="Pool object" value={shortenAddress(pool.id, 8, 6)} />
      <Metric label="Current tick" value={pool.currentTickIndex == null ? "—" : formatInteger(pool.currentTickIndex)} />
      <Metric label="Tick spacing" value={pool.tickSpacing ?? "—"} />
      <Metric label="Liquidity" value={compactBaseUnits(pool.liquidity)} />
    </div>
    <div className={styles.poolFooter}><span>Version {pool.version ?? "—"}</span><button className="button-secondary" disabled>Manage <ChevronRight size={14} /></button></div>
  </section>;
}

function PositionCard({ position }: { position: PoolPosition }) {
  const stateLabel = position.rangeState === "in-range" ? "In range" : position.rangeState === "below-range" ? "Below range" : position.rangeState === "above-range" ? "Above range" : "Range unknown";
  return <article className={`card ${styles.positionCard}`}>
    <div className={styles.positionHead}>
      <div><small>Position</small><strong>{shortenAddress(position.objectId, 9, 7)}</strong></div>
      <span className={`${styles.rangeBadge} ${position.rangeState === "in-range" ? styles.rangeGood : position.rangeState === "unknown" ? "" : styles.rangeWarn}`}><Activity size={12} /> {stateLabel}</span>
    </div>
    <div className={styles.positionGrid}>
      <Metric label="Liquidity" value={compactBaseUnits(position.liquidity)} />
      <Metric label="Tick range" value={position.tickLower == null || position.tickUpper == null ? "—" : `${formatInteger(position.tickLower)} → ${formatInteger(position.tickUpper)}`} />
      <Metric label="Current tick" value={position.currentTickIndex == null ? "—" : formatInteger(position.currentTickIndex)} />
      <Metric label="Pool" value={position.poolObjectId ? shortenAddress(position.poolObjectId, 7, 5) : "—"} />
    </div>
    {(position.feeOwedA || position.feeOwedB || position.rewardOwed?.length) ? <div className={styles.positionOwed}>
      <span>Raw on-chain owed amounts</span>
      <strong>A {compactBaseUnits(position.feeOwedA)} · B {compactBaseUnits(position.feeOwedB)}{position.rewardOwed?.length ? ` · ${position.rewardOwed.length} reward field(s)` : ""}</strong>
    </div> : null}
    <div className={styles.positionActions}><button className="button-secondary" disabled>Collect</button><button className="button-secondary" disabled>Remove</button><button className="button-primary" disabled>Manage position</button></div>
  </article>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  return <div className={styles.lpMetric}><small>{label}</small><strong className={tone === "success" ? styles.successText : tone === "warning" ? styles.warningText : ""}>{value}</strong></div>;
}
function compactBaseUnits(value?: string | null) { if (!value || !/^\d+$/.test(value)) return "—"; if (value.length <= 9) return value; return `${value.slice(0, 6)}…${value.slice(-4)}`; }
function PoolSkeleton() { return <div className={`card ${styles.poolCard}`} aria-busy="true"><div className="skeleton" style={{ height: 34, width: "42%" }} /><div className={styles.poolStats}>{[0,1,2,3].map((n)=><div className="skeleton" style={{height:64}} key={n}/>)}</div></div>; }
