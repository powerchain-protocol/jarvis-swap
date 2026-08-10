"use client";

import { ArrowDownToLine, ArrowUpFromLine, Check, Copy, ExternalLink, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@/components/wallet/wallet-provider";
import { PUBLIC_SUI_NETWORK } from "@/constants/network";
import { sendSuiAsset } from "@/services/transfers/send";
import { receiveDetails } from "@/services/transfers/receive";
import type { TransferToken } from "@/types/transfers";
import { compareUnsignedDecimalText, isPositiveDecimalText, shortenAddress, subtractUnsignedDecimalText } from "@/utils/formats";
import styles from "./services.module.css";
import { useDialogA11y } from "@/hooks/use-dialog";
import { useToast } from "@/components/shared/toast-provider";
import { baseUnitsToDecimalString } from "@/services/fees/service-fee";
import { API_ROUTES } from "@/constants/routes";
import { readApiJson } from "@/utils/api-client";
import { useWalletData } from "@/hooks/use-wallet-data";

const SUI: TransferToken = { symbol: "SUI", name: "Sui", coinType: "0x2::sui::SUI", decimals: 9 };

export function SendReceivePanel({ mode, onClose }: { mode: "send" | "receive"; onClose: () => void }) {
  const { accountAddress, signTransaction } = useWallet();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [gasReserveMist, setGasReserveMist] = useState(20_000_000);
  const receive = useMemo(() => accountAddress ? receiveDetails(accountAddress, PUBLIC_SUI_NETWORK) : null, [accountAddress]);
  const walletData = useWalletData(mode === "send" ? accountAddress : null);
  const suiBalance = walletData.data?.balances.find((entry) => entry.coinType === SUI.coinType);
  const balanceText = suiBalance && /^\d+$/.test(suiBalance.totalBalance) ? baseUnitsToDecimalString(BigInt(suiBalance.totalBalance), SUI.decimals) : walletData.status === "ready" ? "0" : null;
  const balanceLoading = walletData.status === "loading";
  const dialogRef = useDialogA11y<HTMLElement>(true, onClose, { closeOnEscape: !busy });
  const { pushToast } = useToast();
  const gasReserveText = baseUnitsToDecimalString(BigInt(gasReserveMist), 9);
  const spendableText = balanceText == null ? null : subtractUnsignedDecimalText(balanceText, gasReserveText);
  const exceedsSpendable = Boolean(spendableText && isPositiveDecimalText(amount) && compareUnsignedDecimalText(amount, spendableText) > 0);

  useEffect(() => {
    if (mode !== "send") return;
    const controller = new AbortController();
    void fetch(API_ROUTES.swapConfig, { cache: "no-store", signal: controller.signal })
      .then((response) => readApiJson<{ gasReserveMist?: number }>(response))
      .then((config) => { if (Number.isInteger(config?.gasReserveMist)) setGasReserveMist(config!.gasReserveMist!); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [mode]);

  async function submit() {
    if (!accountAddress) return;
    setBusy(true); setError(null); setDigest(null);
    try {
      if (spendableText == null) throw new Error("Wallet balance is unavailable. Refresh and try again.");
      if (exceedsSpendable) throw new Error("Amount exceeds spendable SUI after the network-gas reserve.");
      const result = await sendSuiAsset({ sender: accountAddress, recipient, amount, token: SUI, signTransaction });
      setDigest(result.digest);
      pushToast({ kind: "success", title: "SUI sent", message: `Confirmed on Sui · ${shortenAddress(result.digest, 9, 7)}` });
      window.dispatchEvent(new CustomEvent("jarvis-swap:transaction-confirmed", { detail: { digest: result.digest, kind: "send" } }));
      void walletData.refresh(true);
    } catch (cause) { const message = cause instanceof Error ? cause.message : "Unable to send SUI."; setError(message); pushToast({ kind: "error", title: "Send failed", message }); }
    finally { setBusy(false); }
  }

  async function copy() {
    if (!receive) return;
    try {
      await navigator.clipboard.writeText(receive.address);
      setCopied(true);
      pushToast({ kind: "success", title: "Address copied", message: `Sui ${PUBLIC_SUI_NETWORK} receive address copied.` });
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      const message = "Unable to copy the address. Select and copy it manually.";
      setError(message);
      pushToast({ kind: "error", title: "Copy failed", message });
    }
  }

  return <div className={styles.backdrop} onMouseDown={() => { if (!busy) onClose(); }}>
    <section ref={dialogRef} tabIndex={-1} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="wallet-service-title" onMouseDown={(e)=>e.stopPropagation()}>
      <header><div>{mode === "send" ? <ArrowUpFromLine size={20}/> : <ArrowDownToLine size={20}/>}<div><strong id="wallet-service-title">{mode === "send" ? "Send SUI" : "Receive assets"}</strong><span>Sui {PUBLIC_SUI_NETWORK}</span></div></div><button onClick={onClose} disabled={busy} aria-label="Close"><X size={18}/></button></header>
      {!accountAddress ? <p className={styles.error}>Connect a Sui wallet first.</p> : mode === "receive" && receive ? <div className={styles.receiveBox}>
        <span>Your Sui address</span><strong>{shortenAddress(receive.address, 10, 8)}</strong><code>{receive.address}</code>
        <div className={styles.actions}><button onClick={copy}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy address"}</button><a href={receive.explorerUrl} target="_blank" rel="noreferrer">Suiscan <ExternalLink size={15}/></a></div>
        <p>Only send Sui-network assets to this address. Verify the network and token type before transferring.</p>
      </div> : <div className={styles.form}>
        <label>Asset<div className={styles.asset}>SUI <small>0x2::sui::SUI</small></div></label>
        <label>Recipient<input value={recipient} onChange={(e)=>setRecipient(e.target.value)} placeholder="0x…" autoCapitalize="off" autoCorrect="off" /></label>
        <label>Amount<div className={styles.amount}><input value={amount} onChange={(e)=>{ const next=e.target.value; if(next === "" || /^\d*(\.\d*)?$/.test(next)) setAmount(next); }} inputMode="decimal" placeholder="0.00"/><span>SUI</span></div></label>
        <p className={styles.note}>{balanceLoading ? "Loading wallet balance…" : spendableText == null ? "Available balance: —" : compareUnsignedDecimalText(spendableText, "0") > 0 ? `Available to send: ${spendableText} SUI · ${gasReserveText} SUI reserved for gas` : "No spendable SUI balance after the gas reserve."}</p>
        {exceedsSpendable ? <p className={styles.error}>Amount exceeds your spendable SUI balance.</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}{digest ? <p className={styles.success}>Submitted: {shortenAddress(digest, 9, 7)}</p> : null}
        <button className={styles.primary} onClick={()=>void submit()} disabled={busy || balanceLoading || spendableText == null || compareUnsignedDecimalText(spendableText, "0") <= 0 || exceedsSpendable || !recipient.trim() || !isPositiveDecimalText(amount)}>{busy ? "Confirming…" : "Review & send"}</button>
        <p className={styles.note}>JARVIS simulates the exact signed transaction before submission. Network gas is charged by Sui.</p>
      </div>}
    </section>
  </div>;
}
