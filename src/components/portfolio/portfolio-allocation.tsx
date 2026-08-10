"use client";
import type { PortfolioAsset } from "@/types/portfolio";
import { formatFiatValue, formatPercentRatio } from "@/utils/formats";

export function PortfolioAllocation({ assets }: { assets: PortfolioAsset[] }) {
  const rows = assets.filter((a) => (a.valueUsd ?? 0) > 0).slice(0, 8);
  if (!rows.length) return <div className="empty-state">No priced assets available for allocation.</div>;
  return <div style={{display:"grid",gap:12}}>
    {rows.map((asset) => <div key={asset.coinType} style={{display:"grid",gridTemplateColumns:"minmax(72px,110px) 1fr auto",gap:12,alignItems:"center"}}>
      <strong style={{overflow:"hidden",textOverflow:"ellipsis"}}>{asset.symbol}</strong>
      <div aria-label={`${asset.symbol} portfolio allocation`} style={{height:8,borderRadius:999,background:"var(--border)",overflow:"hidden"}}><div style={{height:"100%",width:`${Math.max(1,Math.min(100,asset.allocationPct??0))}%`,background:"var(--accent)"}} /></div>
      <div style={{textAlign:"right"}}><strong>{formatPercentRatio((asset.allocationPct??0)/100)}</strong><small style={{display:"block"}}>{formatFiatValue(asset.valueUsd??0)}</small></div>
    </div>)}
  </div>;
}
