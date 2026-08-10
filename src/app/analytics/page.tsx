import Link from "next/link";
import { Activity, Database, ExternalLink, ShieldCheck } from "lucide-react";
import ui from "../workspace.module.css";

export default function AnalyticsPage() {
  return <div className="page-width">
    <div className="page-header"><div><h1 className="section-title">Analytics</h1><p className="section-subtitle">Production analytics are shown only when backed by the configured indexer and persisted snapshots. JARVIS does not present illustrative market numbers as live data.</p></div></div>
    <div className={ui.analyticsGrid}>
      <section className={`card ${ui.statusPanel}`}><Database size={20} color="var(--accent)" /><h2>Indexer-backed analytics</h2><p>The application already persists portfolio, pool, price, and transaction observations. Connect the production analytics/indexer pipeline to populate market-wide TVL, volume, trader, pair, and fee aggregates.</p><div className={ui.statusActions}><Link className="button-primary" href="/activity"><Activity size={15}/>View live activity</Link><Link className="button-secondary" href="/docs">Data architecture <ExternalLink size={14}/></Link></div></section>
      <section className={`card ${ui.sectionCard}`}><div className={ui.sectionHead}><div><h2>Data integrity</h2><p>Production display policy.</p></div><ShieldCheck size={18} color="var(--success)" /></div><dl className={ui.statusList}><div><dt>Blockchain source</dt><dd>Sui finality</dd></div><div><dt>Price policy</dt><dd>Freshness checked</dd></div><div><dt>Unknown values</dt><dd>Never fabricated</dd></div><div><dt>Realtime events</dt><dd>Refresh hints only</dd></div></dl></section>
    </div>
  </div>;
}
