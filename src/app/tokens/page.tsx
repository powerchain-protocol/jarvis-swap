"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useWallet } from "@/components/wallet/wallet-provider";
import { fetchPortfolioClient } from "@/services/portfolio/client";
import type { PortfolioAsset } from "@/types/portfolio";
import { VirtualTokenList } from "@/components/tokens/virtual-token-list";
import { PageState } from "@/components/shared/page-state";
import ui from "../workspace.module.css";

export default function TokensPage() {
  const wallet = useWallet();
  const [query, setQuery] = useState("");
  const [tokens, setTokens] = useState<PortfolioAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const address = wallet.accountAddress;
    requestId.current += 1;
    const id = requestId.current;
    if (!address) { setTokens([]); setError(""); setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchPortfolioClient(address, false, controller.signal)
      .then((portfolio) => { if (id === requestId.current) setTokens(portfolio.assets); })
      .catch((cause) => { if (!controller.signal.aborted && id === requestId.current) setError(cause instanceof Error ? cause.message : "Unable to discover tokens"); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
    return () => controller.abort();
  }, [wallet.accountAddress]);

  const shown = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tokens.filter((token) => !normalized || `${token.symbol} ${token.name} ${token.coinType}`.toLowerCase().includes(normalized));
  }, [tokens, query]);

  return <div className="page-width">
    <div className="page-header"><div><h1 className="section-title">Tokens</h1><p className="section-subtitle">Discover owned Sui assets by symbol, name, or exact coin type. User-imported assets remain explicitly unverified.</p></div></div>
    <section className={`card ${ui.sectionCard}`}>
      <div className={ui.tokensToolbar}>
        <label className={ui.searchWrap}><Search size={17} /><input className="field-input" value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search token or paste Sui coin type" autoComplete="off" spellCheck={false} /></label>
        <Link className="button-secondary" href="/swap" title="Open Swap and use the token selector to import a custom Sui coin type"><Plus size={16} /> Import token</Link>
      </div>
      {wallet.accountAddress && !loading && !error ? <p className={ui.resultCount} aria-live="polite">{shown.length} of {tokens.length} assets</p> : null}
      {!wallet.accountAddress ? <PageState kind="empty" title="Connect your wallet" description="Connect a Sui wallet to discover its owned token balances." /> : loading ? <PageState kind="loading" title="Discovering tokens" description="Reading balances and token metadata from Sui." /> : error ? <PageState kind="error" title="Token discovery unavailable" description={error} /> : shown.length ? <VirtualTokenList items={shown} /> : <PageState kind="empty" title="No matching tokens" description="Try another symbol, name, or exact Sui coin type." />}
    </section>
  </div>;
}
