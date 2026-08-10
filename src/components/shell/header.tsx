"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Moon, Sun } from "lucide-react";
import { JarvisLogo } from "@/components/branding/logo";
import { WalletButton } from "@/components/wallet/wallet-button";
import { useTheme } from "@/components/shared/theme-provider";
import { useRpc } from "@/context";
import styles from "./shell.module.css";

const links = ["Swap", "Pool", "Tokens", "Portfolio", "Bridge", "Analytics", "Docs"];

export function Header({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const rpc = useRpc();

  return (
    <header className={styles.header}>
      <div className={styles.brandWrap}>
        <button className={styles.mobileMenu} onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button>
        <Link href="/swap" aria-label="JARVIS Swap home"><JarvisLogo /></Link>
      </div>
      <nav className={styles.topNav} aria-label="Primary navigation">
        {links.map((item) => {
          const href = `/${item.toLowerCase()}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return <Link key={item} href={href} aria-current={active ? "page" : undefined} className={active ? styles.activeTopNav : undefined}><span>{item}</span></Link>;
        })}
      </nav>
      <div className={styles.actions}>
        <div className={styles.network} title={`Sui ${rpc.network} · ${rpc.data?.ok ? "RPC healthy" : rpc.loading ? "Checking RPC" : "RPC degraded"}`}><span className={styles.suiGlyph}>S</span><span>Sui {rpc.network === "mainnet" ? "Mainnet" : rpc.network === "testnet" ? "Testnet" : "Devnet"}</span><i data-status={rpc.data?.ok ? "healthy" : "degraded"} /></div>
        <WalletButton />
        <button className={styles.themeButton} onClick={toggleTheme} aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}>
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}
