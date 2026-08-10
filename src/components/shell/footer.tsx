import Link from "next/link";
import { JarvisLogo } from "@/components/branding/logo";
import styles from "./shell.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <JarvisLogo compact />
      <p>JARVIS is canonical on Sui. Cross-chain representations are bridged assets.</p>
      <nav><Link href="/docs">Docs</Link><Link href="/bridge">Bridge</Link><Link href="/activity">Activity</Link><Link href="/settings">Settings</Link></nav>
    </footer>
  );
}
