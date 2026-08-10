"use client";

import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, Copy, LogOut, ShieldCheck, WalletCards } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useWallet } from "./wallet-provider";
import { WalletConnectModal } from "./wallet-connect-modal";
import { SendReceivePanel } from "@/components/services/send-receive-panel";
import styles from "./wallet.module.css";
import { useToast } from "@/components/shared/toast-provider";
import { useWalletData } from "@/hooks/use-wallet-data";
import { baseUnitsToDecimalString } from "@/services/fees/service-fee";

function short(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const { accountAddress, wallet, disconnect, session, verifySession, verifying } = useWallet();
  const [connectOpen, setConnectOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [serviceMode, setServiceMode] = useState<"send" | "receive" | null>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToast();
  const walletData = useWalletData(accountAddress);
  const suiBalance = walletData.data?.balances.find((item) => item.coinType === "0x2::sui::SUI");
  const suiBalanceText = suiBalance && /^\d+$/.test(suiBalance.totalBalance)
    ? baseUnitsToDecimalString(BigInt(suiBalance.totalBalance), 9)
    : null;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
  }, [menuOpen]);

  async function copyAddress() {
    if (!accountAddress) return;
    try {
      await navigator.clipboard.writeText(accountAddress);
      setCopied(true);
      pushToast({ kind: "success", title: "Address copied", message: "Your connected Sui address is ready to paste." });
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      pushToast({ kind: "error", title: "Copy failed", message: "Select the address from Receive and copy it manually." });
    }
  }

  if (!accountAddress) {
    return (
      <>
        <button className={styles.walletButton} onClick={() => setConnectOpen(true)}>
          <WalletCards size={17} />
          <span>Connect Wallet</span>
        </button>
        <WalletConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
      </>
    );
  }

  return (
    <>
    <div className={styles.accountWrap} ref={accountRef}>
      <button className={styles.walletButton} onClick={() => setMenuOpen((value: boolean) => !value)} aria-expanded={menuOpen} aria-haspopup="menu">
        <span className={styles.walletDot} />
        <span>{short(accountAddress)}</span>
        <ChevronDown size={15} />
      </button>
      {menuOpen && (
        <div className={styles.accountMenu} role="menu">
          <div className={styles.accountMeta}>
            <strong>{wallet?.name ?? "Sui wallet"}</strong>
            <span>{short(accountAddress)}</span>
            <small>{session.authenticated ? "Verified JARVIS session" : session.required ? "Verification required" : "Wallet connected"}</small>
            <small className={styles.balanceStatus}>{walletData.status === "loading" ? "Loading SUI balance…" : walletData.status === "error" ? "Balance unavailable" : suiBalanceText == null ? "Balance —" : suiBalanceText === "0" ? "No SUI balance" : `${suiBalanceText} SUI`}</small>
          </div>
          {!session.authenticated && session.configured ? <button disabled={verifying} onClick={() => void verifySession().then(() => pushToast({ kind: "success", title: "Wallet verified", message: "Secure JARVIS session established." })).catch((cause) => pushToast({ kind: "error", title: "Verification failed", message: cause instanceof Error ? cause.message : "Unable to verify wallet." }))}><ShieldCheck size={16} />{verifying ? "Verifying…" : "Verify session"}</button> : null}
          <button onClick={() => { setServiceMode("send"); setMenuOpen(false); }}><ArrowUpFromLine size={16} />Send</button>
          <button onClick={() => { setServiceMode("receive"); setMenuOpen(false); }}><ArrowDownToLine size={16} />Receive</button>
          <button onClick={copyAddress}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy address"}</button>
          <button onClick={() => void disconnect().finally(() => setMenuOpen(false))}><LogOut size={16} />Disconnect</button>
        </div>
      )}
    </div>
      {serviceMode ? <SendReceivePanel mode={serviceMode} onClose={() => setServiceMode(null)} /> : null}
    </>
  );
}
