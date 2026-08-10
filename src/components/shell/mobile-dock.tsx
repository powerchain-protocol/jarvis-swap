"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Coins, Droplets, Repeat2, WalletCards } from "lucide-react";
import styles from "./shell.module.css";

const items = [
  ["Swap", "/swap", Repeat2],
  ["Pool", "/pool", Droplets],
  ["Tokens", "/tokens", Coins],
  ["Portfolio", "/portfolio", WalletCards],
  ["Activity", "/activity", Activity],
] as const;

export function MobileDock() {
  const pathname = usePathname();
  return (
    <nav className={styles.mobileDock} aria-label="Mobile navigation">
      {items.map(([label, href, Icon]) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={active ? styles.mobileDockActive : undefined}><Icon aria-hidden="true" /><span>{label}</span></Link>;
      })}
    </nav>
  );
}
