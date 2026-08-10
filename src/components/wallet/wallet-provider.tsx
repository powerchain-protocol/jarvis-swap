"use client";

import { getWallets, type Wallet } from "@wallet-standard/app";
import { signTransaction as walletStandardSignTransaction } from "@mysten/wallet-standard";
import type { Transaction } from "@mysten/sui/transactions";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PUBLIC_SUI_NETWORK, STORAGE_KEYS } from "@/constants";
import { readStorageString, removeStorage, writeStorageString } from "@/utils/storage";
import { fetchWalletSession, logoutWalletSession, requestWalletChallenge, verifyWalletSession } from "@/services/session/client";
import type { WalletSession } from "@/types/sessions";

const SUI_CHAIN = `sui:${PUBLIC_SUI_NETWORK}`;
const LAST_WALLET_KEY = STORAGE_KEYS.wallet;

type WalletAccount = Wallet["accounts"][number];
type ConnectFeature = { connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }> };
type DisconnectFeature = { disconnect: () => Promise<void> };
type EventsFeature = { on: (event: "change", listener: (properties: { accounts?: readonly WalletAccount[] }) => void) => () => void };
type SignPersonalMessageFeature = { signPersonalMessage: (input: { message: Uint8Array; account: WalletAccount }) => Promise<{ bytes?: string; signature: string }> };

type WalletContextValue = {
  wallets: readonly Wallet[];
  wallet: Wallet | null;
  accountAddress: string | null;
  network: "sui";
  chain: string;
  connecting: boolean;
  verifying: boolean;
  error: string | null;
  session: WalletSession;
  connect: (wallet: Wallet, silent?: boolean) => Promise<string>;
  connectAndVerify: (wallet: Wallet) => Promise<void>;
  verifySession: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
  signTransaction: (transaction: Transaction) => Promise<{ bytes: string; signature: string }>;
};

const WalletContext = createContext<WalletContextValue | null>(null);
const EMPTY_SESSION: WalletSession = { authenticated: false, configured: false, required: false };

function isSuiWallet(wallet: Wallet) {
  if (/suiet/i.test(wallet.name)) return false;
  return wallet.chains?.some((chain) => chain.startsWith("sui:")) && Boolean(wallet.features["standard:connect"]);
}

function pickSuiAccount(accounts: readonly WalletAccount[]) {
  return accounts.find((account) => account.chains.includes(SUI_CHAIN)) ?? null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallets, setWallets] = useState<readonly Wallet[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<WalletSession>(EMPTY_SESSION);
  const reconnectAttempted = useRef(false);

  const refreshSession = useCallback(async (expectedAddress?: string | null) => {
    try {
      const next = await fetchWalletSession();
      if (next.authenticated && expectedAddress && next.address?.toLowerCase() !== expectedAddress.toLowerCase()) {
        await logoutWalletSession();
        setSession({ ...next, authenticated: false, address: undefined, expiresAt: undefined, issuedAt: undefined });
        return;
      }
      setSession(next);
    } catch {
      setSession((current) => ({ ...current, authenticated: false, address: undefined, expiresAt: undefined, issuedAt: undefined }));
    }
  }, []);

  const connect = useCallback(async (nextWallet: Wallet, silent = false) => {
    const feature = nextWallet.features["standard:connect"] as ConnectFeature | undefined;
    if (!feature) throw new Error("Wallet does not support Wallet Standard connection.");

    setConnecting(true);
    setError(null);
    try {
      const result = await feature.connect({ silent });
      const account = pickSuiAccount(result.accounts);
      if (!account) throw new Error(`No wallet account is connected to ${SUI_CHAIN}. Switch the wallet network and try again.`);
      setWallet(nextWallet);
      setAccountAddress(account.address);
      writeStorageString(LAST_WALLET_KEY, nextWallet.name, 128);
      return account.address;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet connection failed.";
      if (!silent) setError(message);
      throw cause;
    } finally {
      setConnecting(false);
    }
  }, []);

  const verifyConnectedAccount = useCallback(async (targetWallet: Wallet, address: string) => {
    const account = targetWallet.accounts.find((candidate) => candidate.address === address && candidate.chains.includes(SUI_CHAIN));
    if (!account) throw new Error("The active Sui account is no longer available in the wallet.");
    const feature = targetWallet.features["sui:signPersonalMessage"] as SignPersonalMessageFeature | undefined;
    if (!feature?.signPersonalMessage) throw new Error("This wallet does not support the Wallet Standard personal-message signature required for secure JARVIS sessions.");

    setVerifying(true);
    setError(null);
    try {
      const challenge = await requestWalletChallenge(address);
      const signed = await feature.signPersonalMessage({ message: new TextEncoder().encode(challenge.message), account });
      if (!signed?.signature) throw new Error("Wallet did not return a personal-message signature.");
      const verified = await verifyWalletSession({ address, token: challenge.token, signature: signed.signature });
      setSession(verified);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet verification failed.";
      setError(message);
      throw cause;
    } finally {
      setVerifying(false);
    }
  }, [session.required]);

  const connectAndVerify = useCallback(async (nextWallet: Wallet) => {
    const address = await connect(nextWallet);
    await refreshSession(address);
    // A valid existing HTTP-only session avoids another signature prompt.
    const current = await fetchWalletSession().catch(() => EMPTY_SESSION);
    setSession(current);
    if (!current.configured && !current.required) return;
    if (!current.authenticated || current.address?.toLowerCase() !== address.toLowerCase()) {
      await verifyConnectedAccount(nextWallet, address);
    }
  }, [connect, refreshSession, verifyConnectedAccount]);

  const verifySession = useCallback(async () => {
    if (!wallet || !accountAddress) throw new Error("Connect a Sui wallet first.");
    await verifyConnectedAccount(wallet, accountAddress);
  }, [wallet, accountAddress, verifyConnectedAccount]);

  useEffect(() => {
    const registry = getWallets();
    const sync = () => setWallets(registry.get().filter(isSuiWallet));
    sync();
    const offRegister = registry.on("register", sync);
    const offUnregister = registry.on("unregister", sync);
    return () => { offRegister(); offUnregister(); };
  }, []);

  useEffect(() => { void refreshSession(accountAddress); }, [accountAddress, refreshSession]);

  // Do not let the client keep presenting an expired HTTP-only wallet session
  // as authenticated. Refresh at expiry and whenever the tab becomes active.
  useEffect(() => {
    if (!session.authenticated || !session.expiresAt) return;
    const remaining = Math.max(0, session.expiresAt - Date.now());
    const timer = window.setTimeout(() => { void refreshSession(accountAddress); }, Math.min(remaining + 250, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [session.authenticated, session.expiresAt, accountAddress, refreshSession]);

  useEffect(() => {
    const refreshIfActive = () => {
      if (document.visibilityState === "visible") void refreshSession(accountAddress);
    };
    document.addEventListener("visibilitychange", refreshIfActive);
    window.addEventListener("online", refreshIfActive);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfActive);
      window.removeEventListener("online", refreshIfActive);
    };
  }, [accountAddress, refreshSession]);

  useEffect(() => {
    if (!wallet) return;
    const feature = wallet.features["standard:events"] as EventsFeature | undefined;
    if (!feature?.on) return;
    return feature.on("change", ({ accounts }) => {
      if (!accounts) return;
      const account = pickSuiAccount(accounts);
      if (!account) {
        setWallet(null); setAccountAddress(null); setSession((current) => ({ ...current, authenticated: false, address: undefined })); removeStorage(LAST_WALLET_KEY);
        void logoutWalletSession();
        return;
      }
      if (account.address !== accountAddress) {
        setAccountAddress(account.address);
        setSession((current) => ({ ...current, authenticated: false, address: undefined }));
        void logoutWalletSession();
      }
    });
  }, [wallet, accountAddress]);

  useEffect(() => {
    if (!wallets.length || wallet || reconnectAttempted.current) return;
    reconnectAttempted.current = true;
    const lastWallet = readStorageString(LAST_WALLET_KEY, 128);
    if (!lastWallet) return;
    const found = wallets.find((candidate) => candidate.name === lastWallet);
    if (!found) { removeStorage(LAST_WALLET_KEY); return; }
    void connect(found, true).then((address) => refreshSession(address)).catch(() => removeStorage(LAST_WALLET_KEY));
  }, [connect, refreshSession, wallet, wallets]);

  const disconnect = useCallback(async () => {
    setError(null);
    try {
      const feature = wallet?.features["standard:disconnect"] as DisconnectFeature | undefined;
      if (feature) await feature.disconnect();
    } finally {
      await logoutWalletSession();
      setWallet(null); setAccountAddress(null); setSession((current) => ({ ...current, authenticated: false, address: undefined, expiresAt: undefined, issuedAt: undefined })); removeStorage(LAST_WALLET_KEY);
    }
  }, [wallet]);

  const signTransaction = useCallback(async (transaction: Transaction) => {
    if (!wallet || !accountAddress) throw new Error("Connect a Sui wallet before signing.");
    if (session.required && (!session.authenticated || session.address?.toLowerCase() !== accountAddress.toLowerCase())) throw new Error("Verify your wallet session before signing a transaction.");
    const account = wallet.accounts.find((candidate) => candidate.address === accountAddress);
    if (!account) throw new Error("The active Sui account is no longer available in the wallet.");
    if (!account.chains.includes(SUI_CHAIN)) throw new Error(`The active wallet account is not connected to ${SUI_CHAIN}.`);
    const compatibleWallet = wallet as Parameters<typeof walletStandardSignTransaction>[0];
    const input = { transaction, account, chain: SUI_CHAIN } as Parameters<typeof walletStandardSignTransaction>[1];
    const result = await walletStandardSignTransaction(compatibleWallet, input);
    if (!result?.bytes || !result?.signature) throw new Error("Wallet did not return signed transaction bytes.");
    return { bytes: result.bytes, signature: result.signature };
  }, [wallet, accountAddress, session]);

  const value = useMemo<WalletContextValue>(() => ({
    wallets, wallet, accountAddress, network: "sui", chain: SUI_CHAIN, connecting, verifying, error, session,
    connect, connectAndVerify, verifySession, disconnect, clearError: () => setError(null), signTransaction,
  }), [wallets, wallet, accountAddress, connecting, verifying, error, session, connect, connectAndVerify, verifySession, disconnect, signTransaction]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const value = useContext(WalletContext);
  if (!value) throw new Error("useWallet must be used within WalletProvider");
  return value;
}
