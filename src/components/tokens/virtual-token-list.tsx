"use client";
import { useMemo, useState, type UIEvent } from "react";
import type { PortfolioAsset } from "@/types/portfolio";
import { formatFiatValue, formatTokenAmount } from "@/utils/formats";
const ROW = 68, VIEW = 420, BUFFER = 5;

function freshnessLabel(token: PortfolioAsset) {
  if (token.priceFreshness === "unpriced") return "Unpriced";
  if (token.priceFreshness === "aging") return "Price aging";
  return token.priceProvider ? `${token.priceProvider} price` : "Fresh price";
}

export function VirtualTokenList({ items, onSelect }: { items: PortfolioAsset[]; onSelect?: (t: PortfolioAsset) => void }) {
  const [scroll, setScroll] = useState(0);
  const range = useMemo(() => {
    const start = Math.max(0, Math.floor(scroll / ROW) - BUFFER);
    const end = Math.min(items.length, Math.ceil((scroll + VIEW) / ROW) + BUFFER);
    return { start, end };
  }, [scroll, items.length]);
  return <div onScroll={(event: UIEvent<HTMLDivElement>) => setScroll(event.currentTarget.scrollTop)} style={{ height: Math.min(VIEW, Math.max(ROW, items.length * ROW)), overflow: "auto", position: "relative" }} role="list" aria-label="Token list">
    <div style={{ height: items.length * ROW, position: "relative" }}>
      {items.slice(range.start, range.end).map((token, index) => <button key={token.coinType} role="listitem" onClick={() => onSelect?.(token)} style={{ position: "absolute", top: (range.start + index) * ROW, left: 0, right: 0, height: ROW, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "center", textAlign: "left", padding: "0 12px", border: 0, borderBottom: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", cursor: "pointer" }}>
        <span style={{ minWidth: 0 }}><strong>{token.symbol}</strong><small style={{ display: "block", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{token.name} · {freshnessLabel(token)}</small></span>
        <span style={{ textAlign: "right" }}><strong>{token.valueUsd == null ? "—" : formatFiatValue(token.valueUsd)}</strong><small style={{ display: "block", color: "var(--text-muted)" }}>{formatTokenAmount(token.balance)} {token.symbol}</small></span>
      </button>)}
    </div>
  </div>;
}
