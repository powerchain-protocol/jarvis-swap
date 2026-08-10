"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Coins, Droplets, Repeat2, Route, Settings, WalletCards } from "lucide-react";
import { DEFAULT_SUI_ENDPOINTS, PUBLIC_SUI_NETWORK } from "@/constants/network";
import { useRpc } from "@/context";
import styles from "./shell.module.css";

const nav = [
  ["Swap", "/swap", Repeat2],
  ["Pool", "/pool", Droplets],
  ["Tokens", "/tokens", Coins],
  ["Portfolio", "/portfolio", WalletCards],
  ["Bridge", "/bridge", Route],
  ["Analytics", "/analytics", BarChart3],
  ["Activity", "/activity", Activity],
  ["Settings", "/settings", Settings],
] as const;

export function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const rpc = useRpc();
  const networkLabel = PUBLIC_SUI_NETWORK === "mainnet" ? "Mainnet" : PUBLIC_SUI_NETWORK === "testnet" ? "Testnet" : "Devnet";
  return (
    <aside className={mobile ? styles.drawerSidebar : styles.sidebar}>
      <nav aria-label="Workspace navigation">
        {nav.map(([label, href, Icon]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return <Link className={active ? styles.activeSideNav : undefined} aria-current={active ? "page" : undefined} onClick={onNavigate} key={label} href={href}><Icon size={18} /><span className={styles.navLabel}>{label}</span></Link>;
        })}
      </nav>
      <div className={styles.sideBottom}>
        <div className={styles.live}>
          <div className={styles.liveHeader}><strong>Live on Sui</strong><span><i /> {networkLabel}</span></div>
          <dl>
            <div><dt>Network</dt><dd>Sui</dd></div>
            <div><dt>Status</dt><dd className={rpc.data?.ok ? "positive" : undefined}>{rpc.loading ? "Checking" : rpc.data?.ok ? "Operational" : "Degraded"}</dd></div>
          </dl>
        </div>
        <div className={styles.sideLinks}><Link href="/docs">Docs</Link><span>·</span><a href={DEFAULT_SUI_ENDPOINTS[PUBLIC_SUI_NETWORK].explorer} target="_blank" rel="noreferrer">Suiscan ↗</a></div>
      </div>
    </aside>
  );
}
