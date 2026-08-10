"use client";

import { RotateCcw, ShieldCheck } from "lucide-react";
import { useTheme } from "@/components/shared/theme-provider";
import { useRpc } from "@/context";
import { usePreferences } from "@/hooks/use-preferences";
import { DEFAULT_USER_PREFERENCES } from "@/types/preferences";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { network, data, loading, refresh } = useRpc();
  const { preferences, setPreferences } = usePreferences();
  const healthyRpc = data?.rpcHealth?.filter((endpoint) => endpoint.state === "available").length;
  const quarantinedRpc = data?.rpcHealth?.filter((endpoint) => endpoint.state === "quarantined").length ?? 0;

  return <div className="page-width">
    <div className="page-header"><div><h1 className="section-title">Settings</h1><p className="section-subtitle">Personalize JARVIS Swap without weakening transaction protections. Security-critical limits remain controlled by deployment policy.</p></div></div>
    <div className={styles.grid}>
      <section className={`card ${styles.section}`}>
        <div className={styles.sectionHeader}><div><h2>Experience</h2><p>Preferences are stored locally in this browser and can be changed at any time.</p></div></div>
        <div className={styles.rows}>
          <SettingRow title="Appearance" description="Light is the default JARVIS interface; dark uses the navy production theme."><div className={styles.segmented}><button aria-pressed={theme === "light"} data-active={theme === "light"} onClick={() => setTheme("light")}>Light</button><button aria-pressed={theme === "dark"} data-active={theme === "dark"} onClick={() => setTheme("dark")}>Dark</button></div></SettingRow>
          <SettingRow title="Portfolio currency" description="Choose how portfolio values are presented."><div className={styles.segmented}><button aria-pressed={preferences.fiatCurrency === "USD"} data-active={preferences.fiatCurrency === "USD"} onClick={() => setPreferences({ fiatCurrency: "USD" })}>USD</button><button aria-pressed={preferences.fiatCurrency === "EUR"} data-active={preferences.fiatCurrency === "EUR"} onClick={() => setPreferences({ fiatCurrency: "EUR" })}>EUR</button></div></SettingRow>
          <SettingRow title="Hide small balances" description="Hide wallet assets valued below the portfolio dust threshold."><Toggle on={preferences.hideSmallBalances} label="Hide small balances" onChange={(on) => setPreferences({ hideSmallBalances: on })} /></SettingRow>
          <SettingRow title="Verified assets only" description="Hide imported or discovered assets that are not in a trusted registry."><Toggle on={preferences.hideUnverifiedTokens} label="Verified assets only" onChange={(on) => setPreferences({ hideUnverifiedTokens: on })} /></SettingRow>
        </div>
      </section>
      <aside className={`card ${styles.statusCard}`}>
        <div className={styles.statusTop}><h2>Network & execution</h2><span className={styles.health} data-ok={Boolean(data?.ok)}><i />{loading ? "Checking" : data?.ok ? "Operational" : "Degraded"}</span></div>
        <div className={styles.metrics}>
          <div className={styles.metric}><span>Network</span><strong>Sui {network}</strong></div>
          <div className={styles.metric}><span>RPC cluster</span><strong>{data?.clusterLabel ?? data?.cluster ?? network}</strong></div>
          <div className={styles.metric}><span>RPC endpoints</span><strong>{healthyRpc == null ? (data?.endpointCount ?? 1) : `${healthyRpc}/${data?.rpcHealth?.length ?? data?.endpointCount ?? 1} healthy`}{quarantinedRpc > 0 ? ` · ${quarantinedRpc} cooling down` : ""}</strong></div>
          <div className={styles.metric}><span>RPC pool</span><strong>{data?.rpcPool ? `${data.rpcPool.state}${data.rpcPool.preferredLatencyMs != null ? ` · ${Math.round(data.rpcPool.preferredLatencyMs)} ms` : ""}` : "Warming up"}</strong></div>
          <div className={styles.metric}><span>Preferred read RPC</span><strong>{data?.preferredReadEndpoint ?? "Selecting…"}</strong></div>
          <div className={styles.metric}><span>Checkpoint</span><strong>{data?.checkpoint ?? "—"}</strong></div>
          <div className={styles.metric}><span>Epoch</span><strong>{data?.epoch ?? "—"}</strong></div>
          <div className={styles.metric}><span>Transport</span><strong>{data?.transport ?? "gRPC"}</strong></div>
          <div className={styles.metric}><span>Swap service fee</span><strong>2.50% maximum</strong></div>
          <div className={styles.metric}><span>Execution</span><strong>Simulate → verify → submit → confirm</strong></div>
        </div>
        <div className={styles.notice}><ShieldCheck size={17}/><span>Slippage, maximum price impact, signed quote integrity, fee policy, transaction limits, and Sui finality checks cannot be disabled from this page.</span></div>
        <button className={styles.reset} onClick={() => { setPreferences(DEFAULT_USER_PREFERENCES); setTheme("light"); void refresh(); }}><RotateCcw size={14}/> Reset local preferences</button>
      </aside>
    </div>
  </div>;
}

function SettingRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className={styles.row}><div className={styles.rowCopy}><strong>{title}</strong><span>{description}</span></div>{children}</div>;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return <button className={styles.toggle} data-on={on} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}><span /></button>;
}
