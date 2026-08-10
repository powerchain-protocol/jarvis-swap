"use client";

import Image from "next/image";
import { AlertCircle, CheckCircle2, ChevronRight, ShieldCheck, X } from "lucide-react";
import { useWallet } from "./wallet-provider";
import styles from "./wallet.module.css";
import { useDialogA11y } from "@/hooks/use-dialog";

export function WalletConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallets, connectAndVerify, connecting, verifying, error, clearError, session } = useWallet();
  const busy = connecting || verifying;
  const dialogRef = useDialogA11y<HTMLElement>(open, onClose, { closeOnEscape: !busy });
  if (!open) return null;

  return (
    <div className={styles.backdrop} onMouseDown={() => { if (!busy) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div>
            <span className={styles.eyebrow}>Sui Wallet Standard</span>
            <h2 id="wallet-modal-title">Connect & verify</h2>
            <p>Connect a detected Sui wallet, then sign a personal message to create a secure JARVIS session. The verification signature cannot move funds.</p>
          </div>
          <button className={styles.iconButton} onClick={onClose} disabled={busy} aria-label="Close"><X size={18} /></button>
        </div>

        {error && <div className={styles.walletError} role="alert"><AlertCircle size={16} /><span>{error}</span><button onClick={clearError}>Dismiss</button></div>}
        {verifying && <div className={styles.walletStatus} role="status"><ShieldCheck size={16} /><span>Confirm the JARVIS wallet-verification message in your wallet. No transaction or gas fee is created.</span></div>}

        <div className={styles.walletList}>
          {wallets.length ? wallets.map((candidate) => {
            const supportsSession = Boolean(candidate.features["sui:signPersonalMessage"]);
            return (
              <button key={candidate.name} className={styles.walletRow} disabled={busy || (session.required && !supportsSession)} onClick={() => void connectAndVerify(candidate).then(onClose).catch(() => undefined)}>
                <span className={styles.walletIdentity}>
                  {candidate.icon ? <Image src={candidate.icon} alt="" width={36} height={36} unoptimized /> : <span className={styles.walletFallback}>{candidate.name.slice(0, 1)}</span>}
                  <span><strong>{candidate.name}</strong><small>{supportsSession ? "Detected · Sui · secure session" : "Detected · personal-message signing unavailable"}</small></span>
                </span>
                {supportsSession ? <ChevronRight size={18} /> : <AlertCircle size={17} />}
              </button>
            );
          }) : (
            <div className={styles.empty}><strong>No Sui wallet detected</strong><span>Install or enable a trusted Wallet Standard-compatible Sui wallet, then refresh this page.</span></div>
          )}
        </div>

        <p className={styles.security}><ShieldCheck size={15} /> JARVIS never asks for a seed phrase, private key, or recovery phrase.</p>
        <p className={styles.security}><CheckCircle2 size={15} /> Transaction signatures remain separate: every swap or send is reviewed and signed independently.</p>
      </section>
    </div>
  );
}
