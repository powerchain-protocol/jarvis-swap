import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, LockKeyhole, Route, ShieldCheck } from "lucide-react";
import { SwapInterface } from "@/components/swap/swap-interface";
import styles from "@/components/shared/market.module.css";

export default function SwapPage() {
  return (
    <div className="content-grid">
      <div>
        <div className="page-header">
          <div><h1 className="section-title">Swap</h1><p className="section-subtitle">Trade Sui assets through a reviewed route with exact-input protection, signed quote integrity, simulation, and finality checks.</p></div>
        </div>
        <SwapInterface />
      </div>
      <aside className={styles.rail} aria-label="Swap safeguards">
        <section className={`card ${styles.railCard}`}>
          <div className={styles.railHeader}><div><span className={styles.railKicker}>Execution</span><h3>Swap safeguards</h3></div><ShieldCheck size={18} /></div>
          <div className={styles.safetyList}>
            <Safety icon={<LockKeyhole size={16} />} title="Wallet-controlled signing" copy="JARVIS never receives your private key. The connected Sui wallet signs the exact transaction bytes." />
            <Safety icon={<Route size={16} />} title="Fresh route before signing" copy="Quotes expire quickly and execution validates route, slippage, minimum output, and price impact again." />
            <Safety icon={<CheckCircle2 size={16} />} title="Sui finality required" copy="A transaction digest is treated as submitted, not confirmed, until Sui finality is verified." />
          </div>
        </section>
        <section className={`card ${styles.railCard}`}>
          <div className={styles.railHeader}><div><span className={styles.railKicker}>Fee policy</span><h3>Transparent execution</h3></div></div>
          <dl className={styles.policyList}>
            <div><dt>Service fee cap</dt><dd>2.50%</dd></div>
            <div><dt>Network gas</dt><dd>Simulated</dd></div>
            <div><dt>DEX routing</dt><dd>Cetus</dd></div>
            <div><dt>Canonical network</dt><dd>Sui</dd></div>
          </dl>
          <Link className={styles.railLink} href="/docs">Review security model <ExternalLink size={13} /></Link>
        </section>
      </aside>
    </div>
  );
}

function Safety({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className={styles.safetyItem}><span>{icon}</span><div><strong>{title}</strong><p>{copy}</p></div></div>;
}
