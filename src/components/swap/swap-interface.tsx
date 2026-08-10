"use client";

import { ArrowDownUp, Check, ChevronDown, CircleAlert, Clock3, Info, RefreshCw, Search, Settings, ShieldCheck, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JarvisTokenIcon } from "@/components/branding/logo";
import { useWallet } from "@/components/wallet/wallet-provider";

import { TOKENS } from "@/services/tokens/registry";
import { requestQuote } from "@/services/quotes/client";
import type { Quote, Token } from "@/services/quotes/types";
import { DEFAULT_SWAP_SETTINGS, SWAP_SETTINGS_STORAGE_KEY, normalizeSwapSettings, type RoutingPreference, type SwapSettings } from "@/config/settings";
import { resolveCustomToken } from "@/services/tokens/import-token";
import { executeSwap } from "@/services/transactions/execute";
import { waitForSwapConfirmation } from "@/services/transactions/status";
import { explorerUrl, readSwapActivity, upsertSwapActivity, type SwapActivity } from "@/services/transactions/history";
import { PUBLIC_SUI_NETWORK } from "@/constants/network";
import { fetchWalletData, applyWalletBalances } from "@/services/wallet/client";
import { fetchMarketPrices, applyMarketPrices } from "@/services/prices/client";
import styles from "./swap.module.css";
import { compareUnsignedDecimalText, formatTokenAmount, isPositiveDecimalText, scaleUnsignedDecimalText, subtractUnsignedDecimalText, truncateDecimalText } from "@/utils/formats";
import { baseUnitsToDecimalString } from "@/services/fees/service-fee";
import { readStorageJson, writeStorageJson } from "@/utils/storage";
import { assertCoinType } from "@/services/sui/address";
import { useDialogA11y } from "@/hooks/use-dialog";
import { API_ROUTES } from "@/constants/routes";
import { STORAGE_KEYS } from "@/constants/storage";
import { useToast } from "@/components/shared/toast-provider";

const WalletConnectModal = dynamic(() => import("@/components/wallet/wallet-connect-modal").then((module) => module.WalletConnectModal), { ssr: false });

type Tab = "swap" | "limit" | "dca";
type Phase = "idle" | "quoting" | "ready" | "review" | "signing" | "submitted" | "confirmed" | "error";
type SelectorSide = "pay" | "receive";
type Settings = SwapSettings;
type SwapWorkspace = { paySymbol: string; receiveSymbol: string; payCoinType?: string; receiveCoinType?: string; tab: Tab };
const DEFAULT_SETTINGS = DEFAULT_SWAP_SETTINGS;
const SETTINGS_KEY = SWAP_SETTINGS_STORAGE_KEY;
const CUSTOM_TOKENS_KEY = "jarvis-swap:custom-tokens:v1";
const WORKSPACE_KEY = STORAGE_KEYS.swapWorkspace;
const USD_FORMATTER = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

function fmt(value: number, digits = 6) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}
function sameToken(left: Token, right: Token) {
  if (left.coinType && right.coinType) {
    try { return assertCoinType(left.coinType) === assertCoinType(right.coinType); }
    catch { return left.coinType === right.coinType; }
  }
  return left.symbol === right.symbol;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value)) return "$0.00";
  if (value > 0 && value < 0.01) return `$${value.toFixed(8)}`;
  return USD_FORMATTER.format(value);
}

function TokenIcon({ token, size = 34 }: { token: Token; size?: number }) {
  if (token.symbol === "JARVIS") return <JarvisTokenIcon size={size} />;
  return <span className={styles.simpleIcon} style={{ width: size, height: size }}>{token.symbol.slice(0, 1)}</span>;
}

export function SwapInterface() {
  const { accountAddress, signTransaction } = useWallet();
  const [tab, setTab] = useState<Tab>("swap");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[]>(TOKENS);
  const [pay, setPay] = useState(TOKENS[0]);
  const [receive, setReceive] = useState(TOKENS[1]);
  const [selector, setSelector] = useState<SelectorSide | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [now, setNow] = useState(() => Date.now());
  const [quoteRefreshKey, setQuoteRefreshKey] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [transactionDigest, setTransactionDigest] = useState<string | null>(null);
  const [gasReserveMist, setGasReserveMist] = useState(20_000_000);
  const [activityMaxItems, setActivityMaxItems] = useState(50);
  const [simulatedGasMist, setSimulatedGasMist] = useState<string | null>(null);
  const [balancesLoaded, setBalancesLoaded] = useState(false);
  const [swapExecutionEnabled, setSwapExecutionEnabled] = useState(false);
  const [configuredNetwork, setConfiguredNetwork] = useState<"mainnet" | "testnet" | "devnet" | null>(null);
  const [swapDisabledReason, setSwapDisabledReason] = useState("Swap execution is not ready.");
  const [policyLimits, setPolicyLimits] = useState({ maxSlippageBps: 1000, maxPriceImpactBps: 5000 });
  const quoteRequestId = useRef(0);
  const { pushToast } = useToast();

  const validAmount = isPositiveDecimalText(amount);
  const numericAmount = validAmount ? Number(amount) : 0; // presentation-only USD estimate; base-unit execution stays exact.
  const walletBalanceText = pay.balanceText ?? String(pay.balance);
  const gasReserveText = pay.symbol === "SUI" ? baseUnitsToDecimalString(BigInt(gasReserveMist), 9) : "0";
  const maxSpendableText = pay.symbol === "SUI" ? subtractUnsignedDecimalText(walletBalanceText, gasReserveText) : walletBalanceText;
  const exceedsBalance = Boolean(accountAddress && balancesLoaded) && validAmount && compareUnsignedDecimalText(amount, maxSpendableText) > 0;
  const balancePending = Boolean(accountAddress && !balancesLoaded);
  const sameAsset = sameToken(pay, receive);
  const usdIn = Number.isFinite(numericAmount) ? numericAmount * pay.priceUsd : 0;
  const usdOut = (quote?.amountOut ?? 0) * receive.priceUsd;

  useEffect(() => {
    const controller = new AbortController();
    void fetch(API_ROUTES.swapConfig, { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((config: { tokenTypes?: Record<string, string | undefined>; trustedTokenTypes?: Record<string, string | undefined>; maxPriceImpactBps?: number; maxSlippageBps?: number; gasReserveMist?: number; activityMaxItems?: number; swapExecutionEnabled?: boolean; network?: "mainnet" | "testnet" | "devnet"; feeWalletStatus?: "configured" | "tba" } | null) => {
        if (!config?.tokenTypes) return;
        setTokens((current) => current.map((token) => {
          const coinType = config.tokenTypes?.[token.symbol] ?? token.coinType;
          const trustedCoinType = config.trustedTokenTypes?.[token.symbol];
          return { ...token, coinType, verified: Boolean(coinType && trustedCoinType === coinType) };
        }));
        if (Number.isInteger(config.maxPriceImpactBps) || Number.isInteger(config.maxSlippageBps)) {
          const nextLimits = {
            maxPriceImpactBps: Number.isInteger(config.maxPriceImpactBps) ? Math.max(10, config.maxPriceImpactBps!) : 5000,
            maxSlippageBps: Number.isInteger(config.maxSlippageBps) ? Math.max(1, config.maxSlippageBps!) : 1000,
          };
          setPolicyLimits(nextLimits);
          setSettings((current) => ({
            ...current,
            maxPriceImpactBps: Math.min(current.maxPriceImpactBps, nextLimits.maxPriceImpactBps),
            slippageBps: Math.min(current.slippageBps, nextLimits.maxSlippageBps),
          }));
        }
        if (Number.isInteger(config.gasReserveMist)) setGasReserveMist(config.gasReserveMist!);
        if (Number.isInteger(config.activityMaxItems)) setActivityMaxItems(config.activityMaxItems!);
        if (typeof config.swapExecutionEnabled === "boolean") {
          setSwapExecutionEnabled(config.swapExecutionEnabled);
          if (!config.swapExecutionEnabled) setSwapDisabledReason(config.network === "devnet" ? "Cetus swaps are unavailable on Sui Devnet. Use Testnet or Mainnet." : config.feeWalletStatus === "tba" ? "Service fee wallet is TBA. Configure JARVIS_SWAP_FEE_WALLET before enabling swaps." : "Swap execution is not ready for this deployment.");
        }
        if (config.network) setConfiguredNetwork(config.network);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const storedSettings = readStorageJson<SwapSettings>(SETTINGS_KEY, DEFAULT_SETTINGS, (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      return normalizeSwapSettings(value as Partial<SwapSettings>);
    }, 8 * 1024);
    setSettings(storedSettings);

    const workspace = readStorageJson<SwapWorkspace | null>(WORKSPACE_KEY, null, (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const item = value as Partial<SwapWorkspace>;
      if (typeof item.paySymbol !== "string" || typeof item.receiveSymbol !== "string") return null;
      if (item.tab !== "swap" && item.tab !== "limit" && item.tab !== "dca") return null;
      return {
        paySymbol: item.paySymbol.slice(0, 32),
        receiveSymbol: item.receiveSymbol.slice(0, 32),
        payCoinType: typeof item.payCoinType === "string" ? item.payCoinType.slice(0, 512) : undefined,
        receiveCoinType: typeof item.receiveCoinType === "string" ? item.receiveCoinType.slice(0, 512) : undefined,
        tab: item.tab,
      };
    }, 4 * 1024);
    if (workspace) {
      const findStoredToken = (coinType: string | undefined, symbol: string) =>
        TOKENS.find((token) => Boolean(coinType && token.coinType === coinType)) ?? TOKENS.find((token) => token.symbol === symbol);
      const storedPay = findStoredToken(workspace.payCoinType, workspace.paySymbol);
      const storedReceive = findStoredToken(workspace.receiveCoinType, workspace.receiveSymbol);
      if (storedPay && storedReceive && !sameToken(storedPay, storedReceive)) {
        setPay(storedPay);
        setReceive(storedReceive);
      }
      setTab(workspace.tab);
    }

    const customTokens = readStorageJson<Token[]>(CUSTOM_TOKENS_KEY, [], (value) => {
      if (!Array.isArray(value)) return null;
      const valid = value.filter((token): token is Token => Boolean(
        token && typeof token === "object" && !Array.isArray(token)
        && (token as Token).verified === false
        && typeof (token as Token).coinType === "string"
        && typeof (token as Token).symbol === "string"
        && typeof (token as Token).name === "string"
        && Number.isInteger((token as Token).decimals)
      )).slice(0, 100);
      return valid;
    }, 64 * 1024);
    if (customTokens.length) setTokens([...TOKENS, ...customTokens]);
  }, []);

  useEffect(() => {
    writeStorageJson(SETTINGS_KEY, settings, 8 * 1024);
  }, [settings]);

  useEffect(() => {
    writeStorageJson(WORKSPACE_KEY, {
      paySymbol: pay.symbol,
      receiveSymbol: receive.symbol,
      payCoinType: pay.coinType,
      receiveCoinType: receive.coinType,
      tab,
    } satisfies SwapWorkspace, 4 * 1024);
  }, [pay.coinType, pay.symbol, receive.coinType, receive.symbol, tab]);

  useEffect(() => {
    setSettings((current) => {
      const slippageBps = Math.min(current.slippageBps, policyLimits.maxSlippageBps);
      const maxPriceImpactBps = Math.min(current.maxPriceImpactBps, policyLimits.maxPriceImpactBps);
      return slippageBps === current.slippageBps && maxPriceImpactBps === current.maxPriceImpactBps
        ? current
        : { ...current, slippageBps, maxPriceImpactBps };
    });
  }, [policyLimits.maxPriceImpactBps, policyLimits.maxSlippageBps]);

  useEffect(() => {
    const custom = tokens.filter((token) => !token.verified && token.coinType).slice(0, 100);
    writeStorageJson(CUSTOM_TOKENS_KEY, custom, 64 * 1024);
  }, [tokens]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncToken = (selected: Token, setter: (token: Token) => void) => {
      const next = tokens.find((token) => token.coinType && token.coinType === selected.coinType) ?? tokens.find((token) => token.symbol === selected.symbol);
      if (next && (next.balance !== selected.balance || next.priceUsd !== selected.priceUsd || next.coinType !== selected.coinType)) setter(next);
    };
    syncToken(pay, setPay);
    syncToken(receive, setReceive);
  }, [tokens, pay, receive]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchMarketPrices(tokens.map((token) => token.symbol), controller.signal)
      .then(({ prices }) => { if (prices?.length) setTokens((current) => applyMarketPrices(current, prices)); })
      .catch(() => undefined);
    return () => controller.abort();
  // Refresh pricing when the token universe changes, not when a price update itself changes.
  }, [tokens.length]);

  useEffect(() => {
    setBalancesLoaded(false);
    if (!accountAddress) return;
    const controller = new AbortController();
    const refresh = (force = false) => void fetchWalletData(accountAddress, controller.signal, force)
      .then((data) => { setTokens((current) => applyWalletBalances(current, data)); setBalancesLoaded(true); })
      .catch(() => { if (!controller.signal.aborted) setBalancesLoaded(false); });
    const refreshFresh = () => refresh(true);
    refresh();
    const timer = window.setInterval(() => refresh(), 15_000);
    window.addEventListener("jarvis-swap:transaction-confirmed", refreshFresh);
    window.addEventListener("jarvis-swap:realtime-wallet", refreshFresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("jarvis-swap:transaction-confirmed", refreshFresh);
      window.removeEventListener("jarvis-swap:realtime-wallet", refreshFresh);
    };
  }, [accountAddress]);

  useEffect(() => {
    if (!swapExecutionEnabled || !validAmount || exceedsBalance || sameAsset) {
      quoteRequestId.current += 1;
      setQuote(null);
      setQuoteError(null);
      setPhase("idle");
      return;
    }

    const controller = new AbortController();
    const requestId = ++quoteRequestId.current;
    const timeout = window.setTimeout(async () => {
      setPhase("quoting");
      setQuoteError(null);
      try {
        const nextQuote = await requestQuote({ amountIn: amount, pay, receive, slippageBps: settings.slippageBps, routing: settings.routing, maxPriceImpactBps: settings.maxPriceImpactBps, deadlineMinutes: settings.deadlineMinutes }, controller.signal);
        if (controller.signal.aborted || requestId !== quoteRequestId.current) return;
        setQuote(nextQuote);
        setNow(Date.now());
        setPhase("ready");
      } catch (cause) {
        if (controller.signal.aborted || requestId !== quoteRequestId.current) return;
        setQuote(null);
        setQuoteError(cause instanceof Error ? cause.message : "Unable to get a quote.");
        setPhase("error");
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [amount, validAmount, exceedsBalance, sameAsset, pay, receive, settings.slippageBps, settings.routing, settings.maxPriceImpactBps, settings.deadlineMinutes, quoteRefreshKey, swapExecutionEnabled]);


  useEffect(() => {
    if (!quote || phase !== "ready") return;
    const delay = Math.max(0, quote.expiresAt - Date.now());
    const timeout = window.setTimeout(() => {
      setQuote(null);
      setPhase("idle");
      setQuoteRefreshKey((value) => value + 1);
    }, delay + 25);
    return () => window.clearTimeout(timeout);
  }, [quote, phase]);

  const flip = useCallback(() => {
    setPay(receive);
    setReceive(pay);
    if (quote?.amountOutText) setAmount(truncateDecimalText(quote.amountOutText, Math.min(receive.decimals, 6)));
    setQuote(null);
  }, [pay, quote, receive]);

  function chooseToken(side: SelectorSide, token: Token) {
    if (side === "pay") {
      if (sameToken(token, receive)) setReceive(pay);
      setPay(token);
    } else {
      if (sameToken(token, pay)) setPay(receive);
      setReceive(token);
    }
    setSelector(null);
  }

  const quoteExpired = Boolean(quote && now >= quote.expiresAt);
  const quoteSeconds = quote ? Math.max(0, Math.ceil((quote.expiresAt - now) / 1000)) : 0;

  function primaryAction() {
    if (!swapExecutionEnabled) {
      setQuoteError(swapDisabledReason);
      return;
    }
    if (!accountAddress) {
      setWalletOpen(true);
      return;
    }
    if (!quote || phase !== "ready" || quoteExpired) return;
    setExecutionError(null);
    setPhase("review");
  }

  async function confirmSwap() {
    if (!swapExecutionEnabled) {
      setExecutionError(swapDisabledReason);
      return;
    }
    if (!quote || !accountAddress || Date.now() >= quote.expiresAt) {
      setExecutionError("This quote expired or the wallet is disconnected. Request a fresh quote.");
      return;
    }
    if (!settings.expertMode && quote.priceImpact * 100 > settings.maxPriceImpactBps) {
      setExecutionError(`Price impact exceeds your ${(settings.maxPriceImpactBps / 100).toFixed(2)}% protection limit.`);
      return;
    }
    setPhase("signing");
    setExecutionError(null);
    setTransactionDigest(null);
    setSimulatedGasMist(null);
    let submittedDigest: string | null = null;
    try {
      const result = await executeSwap({
        sender: accountAddress,
        amountIn: amount,
        pay: { ...pay, coinType: quote.payCoinType, decimals: quote.payDecimals },
        receive: { ...receive, coinType: quote.receiveCoinType, decimals: quote.receiveDecimals },
        slippageBps: settings.slippageBps,
        minimumAmountOutBaseUnits: quote.minimumAmountOutBaseUnits,
        quoteExpiresAt: quote.expiresAt,
        deadlineMinutes: settings.deadlineMinutes,
        maxPriceImpactBps: quote.maxPriceImpactBps ?? settings.maxPriceImpactBps,
        routing: settings.routing,
        quotedPriceImpactBps: Math.round(quote.priceImpact * 100),
        mevProtection: settings.mevProtection,
        quoteProof: {
          id: quote.id,
          network: quote.network,
          issuedAt: quote.issuedAt,
          expiresAt: quote.expiresAt,
          payCoinType: quote.payCoinType,
          receiveCoinType: quote.receiveCoinType,
          payDecimals: quote.payDecimals,
          receiveDecimals: quote.receiveDecimals,
          grossAmountInBaseUnits: quote.grossAmountInBaseUnits,
          netSwapAmountBaseUnits: quote.netSwapAmountBaseUnits,
          amountOutBaseUnits: quote.amountOutBaseUnits,
          minimumAmountOutBaseUnits: quote.minimumAmountOutBaseUnits,
          routeCommitment: quote.routeCommitment,
          policyFingerprint: quote.policyFingerprint,
          serviceFeeBaseUnits: quote.serviceFeeBaseUnits,
          serviceFeeBps: quote.serviceFeeBps,
          serviceFeeRecipient: quote.serviceFeeRecipient,
          slippageBps: settings.slippageBps,
          maxPriceImpactBps: quote.maxPriceImpactBps ?? settings.maxPriceImpactBps,
          priceImpactBps: quote.priceImpactBps,
          routing: quote.routing,
          deadlineMinutes: quote.deadlineMinutes,
          signature: quote.signature,
        },
        signTransaction,
        onPreflight: (preflight) => setSimulatedGasMist(preflight.gasUsedMist),
      });
      submittedDigest = result.digest;
      setTransactionDigest(result.digest);
      upsertSwapActivity({ digest: result.digest, account: accountAddress, paySymbol: pay.symbol, receiveSymbol: receive.symbol, amountIn: amount, amountOut: quote.amountOutText, serviceFeeAmount: quote.serviceFeeAmountText, serviceFeeBps: quote.serviceFeeBps, status: "submitted", createdAt: Date.now(), updatedAt: Date.now() }, activityMaxItems);
      setPhase("submitted");
      await waitForSwapConfirmation(result.digest);
      upsertSwapActivity({ digest: result.digest, account: accountAddress, paySymbol: pay.symbol, receiveSymbol: receive.symbol, amountIn: amount, amountOut: quote.amountOutText, serviceFeeAmount: quote.serviceFeeAmountText, serviceFeeBps: quote.serviceFeeBps, status: "confirmed", createdAt: Date.now(), updatedAt: Date.now() }, activityMaxItems);
      window.dispatchEvent(new CustomEvent("jarvis-swap:transaction-confirmed", { detail: { digest: result.digest } }));
      setPhase("confirmed");
      pushToast({ kind: "success", title: "Swap confirmed", message: `${formatTokenAmount(amount, Math.min(pay.decimals, 6))} ${pay.symbol} → ${quote.amountOutText} ${receive.symbol}` });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Swap transaction failed.";
      if (submittedDigest) {
        setExecutionError(`Transaction ${submittedDigest} was submitted, but confirmation is not yet verified. Do not submit the swap again. ${message}`);
        setPhase("submitted");
      } else {
        setExecutionError(message);
        setPhase("review");
        pushToast({ kind: "error", title: "Swap not submitted", message });
      }
    }
  }

  const actionLabel = !swapExecutionEnabled
    ? (configuredNetwork === "devnet" ? "Swaps unavailable on Devnet" : "Swap configuration required")
    : !accountAddress
    ? "Connect wallet"
    : balancePending
      ? "Loading wallet balance…"
    : exceedsBalance
      ? `Insufficient ${pay.symbol} balance`
      : sameAsset
        ? "Select different tokens"
      : !validAmount
        ? "Enter an amount"
        : phase === "quoting"
          ? "Getting quote…"
          : quoteExpired
            ? "Refreshing quote…"
            : quote
            ? "Review swap"
            : "Get quote";

  return (
    <>
      <div className={styles.notice}><ShieldCheck size={16} /><span>Always verify token address and network before swapping.</span><a href="/docs#security">Learn more</a></div>

      <section className={`card ${styles.swapCard}`}>
        <div className={styles.tabs} role="tablist" aria-label="Order type">
          {(["swap", "limit", "dca"] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} className={tab === item ? styles.active : undefined} onClick={() => setTab(item)}>{item === "dca" ? "DCA" : item[0].toUpperCase() + item.slice(1)}</button>)}
          <button className={styles.settings} onClick={() => setSettingsOpen(true)} aria-label="Swap settings"><Settings size={19} /></button>
        </div>

        {tab === "swap" ? (
          <>
            <TokenBox label="You pay" token={pay} value={amount} usd={usdIn} onValue={setAmount} onToken={() => setSelector("pay")} maxValue={maxSpendableText} balanceKnown={Boolean(accountAddress && balancesLoaded)} showQuickAmounts={Boolean(accountAddress && balancesLoaded)} reserveLabel={pay.symbol === "SUI" ? `${formatTokenAmount(gasReserveText, 9)} SUI reserved for gas` : undefined} error={exceedsBalance ? `Amount exceeds spendable ${pay.symbol} balance` : undefined} />
            <button className={styles.flip} onClick={flip} aria-label="Swap direction"><ArrowDownUp size={18} /></button>
            <TokenBox label="You receive (estimated)" token={receive} value={quote ? quote.amountOutText : ""} usd={usdOut} onToken={() => setSelector("receive")} balanceKnown={Boolean(accountAddress && balancesLoaded)} readOnly />

            <div className={styles.details} data-expanded={detailsExpanded ? "true" : "false"}>
              <div className={styles.rateLine}>
                <span>{quote ? `1 ${pay.symbol} = ${fmt(quote.rate, 8)} ${receive.symbol}` : "Best available route"}</span>
                {phase === "quoting" && <span className={styles.quoteStatus} aria-live="polite">Updating…</span>}
                {quote && <span className={styles.quoteBadge}>Live quote · {quoteExpired ? "Expired" : `${quoteSeconds}s`}</span>}
                {validAmount && !sameAsset && <button type="button" className={styles.refreshQuote} onClick={() => setQuoteRefreshKey((value) => value + 1)} disabled={phase === "quoting"} aria-label="Refresh quote"><RefreshCw size={13} className={phase === "quoting" ? styles.spin : undefined} /><span>Refresh</span></button>}
              </div>
              <button className={styles.detailsToggle} type="button" aria-expanded={detailsExpanded} aria-controls="swap-quote-details" onClick={() => setDetailsExpanded((value) => !value)}>
                <span>Trade details</span><ChevronDown size={15} />
              </button>
              <div id="swap-quote-details" className={styles.detailsBody}>
                <Row label="Price impact" value={quote ? `${quote.priceImpact.toFixed(2)}%` : "—"} valueClass={quote && quote.priceImpact >= 1 ? "warning" : quote ? "positive" : undefined} />
                <Row label="Slippage tolerance" value={`${(settings.slippageBps / 100).toFixed(2)}%`} />
                <Row label="Minimum received" value={quote ? `${quote.minimumReceivedText} ${receive.symbol}` : "—"} />
                <Row label="Service fee" value={quote ? `${quote.serviceFeeAmountText} ${pay.symbol} (${(quote.serviceFeeBps / 100).toFixed(2)}%)` : "—"} />
                <Row label="Network gas" value={simulatedGasMist ? `${formatTokenAmount(baseUnitsToDecimalString(BigInt(simulatedGasMist), 9), 9)} SUI simulated` : quote ? "Simulated before submission" : "—"} />
                <Row label="Route" value={quote ? quote.route.join(" → ") : "—"} />
              </div>
            </div>

            {!swapExecutionEnabled && <div className={styles.inlineError}><CircleAlert size={16} />{swapDisabledReason}</div>}
            {quoteError && <div className={styles.inlineError} role="alert"><CircleAlert size={16} />{quoteError}</div>}
            <button className={styles.primary} disabled={!swapExecutionEnabled || sameAsset || balancePending || Boolean(accountAddress && (!quote || phase === "quoting" || exceedsBalance || quoteExpired))} onClick={primaryAction}>{actionLabel}</button>
            <div className={styles.secured}><span><ShieldCheck size={14} /> Secured by Sui Wallet Standard</span><span>Route: {settings.routing.replace("-", " ")}</span></div>
          </>
        ) : (
          <OrderPlaceholder type={tab} pay={pay} receive={receive} onPay={() => setSelector("pay")} onReceive={() => setSelector("receive")} />
        )}
      </section>

      <Recent />
      <TokenSelector tokens={tokens} open={selector !== null} onClose={() => setSelector(null)} onAddCustom={() => { setSelector(null); setCustomOpen(true); }} onSelect={(token) => selector && chooseToken(selector, token)} />
      <CustomTokenModal open={customOpen} onClose={() => setCustomOpen(false)} onAdd={(token) => { setTokens((current) => current.some((item) => item.coinType === token.coinType || (item.symbol === token.symbol && item.name === token.name)) ? current : [...current, token]); setCustomOpen(false); pushToast({ kind: "success", title: `${token.symbol} added`, message: token.verified ? "Exact coin type recognized by the deployment trusted-token registry." : "Custom token added as unverified. Verify the coin type before trading." }); }} />
      <SettingsModal open={settingsOpen} settings={settings} maxSlippageBps={policyLimits.maxSlippageBps} maxPriceImpactBps={policyLimits.maxPriceImpactBps} onChange={setSettings} onClose={() => setSettingsOpen(false)} />
      <Review open={phase === "review" || phase === "signing" || phase === "submitted" || phase === "confirmed"} quote={quote} gasMist={simulatedGasMist} amount={amount} pay={pay} receive={receive} phase={phase} error={executionError} digest={transactionDigest} onClose={() => { setPhase(quote ? "ready" : "idle"); setExecutionError(null); }} onConfirm={confirmSwap} />
      <WalletConnectModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </>
  );
}

function TokenBox({ label, token, value, usd, onValue, onToken, readOnly, maxValue, balanceKnown, showQuickAmounts, reserveLabel, error }: { label: string; token: Token; value: string; usd: number; onValue?: (value: string) => void; onToken: () => void; readOnly?: boolean; maxValue?: string; balanceKnown?: boolean; showQuickAmounts?: boolean; reserveLabel?: string; error?: string }) {
  function change(value: string) {
    if (value === "" || /^\d*(\.\d*)?$/.test(value)) onValue?.(value);
  }
  return (
    <div className={`${styles.tokenBox} ${error ? styles.tokenBoxError : ""}`}>
      <div className={styles.label}>{label}</div>
      <div className={styles.amountRow}>
        <input aria-label={label} inputMode="decimal" value={value} readOnly={readOnly} onChange={(event) => change(event.target.value)} />
        <button className={styles.tokenButton} onClick={onToken} aria-label={`Select token for ${label}`}><TokenIcon token={token} /><strong>{token.symbol}</strong><ChevronDown size={16} /></button>
      </div>
      <div className={styles.meta}>
        <span>≈ {formatUsd(usd)}</span>
        <span>{balanceKnown ? (compareUnsignedDecimalText(token.balanceText ?? "0", "0") > 0 ? <>Balance: {formatTokenAmount(token.balanceText ?? "0", Math.min(token.decimals, 8))} {token.symbol}</> : <>No {token.symbol} balance</>) : <>Balance: —</>} {!readOnly && balanceKnown && maxValue && compareUnsignedDecimalText(maxValue, "0") > 0 ? <button aria-label={`Use maximum ${token.symbol} balance`} onClick={() => onValue?.(maxValue)}>MAX</button> : null}</span>
      </div>
      {!readOnly && showQuickAmounts && maxValue && compareUnsignedDecimalText(maxValue, "0") > 0 && (
        <div className={styles.quickAmounts} aria-label={`${token.symbol} quick amounts`}>
          {[25, 50, 75].map((percent) => (
            <button key={percent} type="button" onClick={() => onValue?.(scaleUnsignedDecimalText(maxValue, percent, 100, token.decimals))}>{percent}%</button>
          ))}
          <button type="button" onClick={() => onValue?.(maxValue)}>MAX</button>
        </div>
      )}
      {reserveLabel && !readOnly && <div className={styles.reserveHint}>{reserveLabel}</div>}
      {error && <div className={styles.inputError}>{error}</div>}
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: "positive" | "warning" }) {
  return <div className={styles.row}><span>{label}</span><strong className={valueClass === "positive" ? "positive" : valueClass === "warning" ? styles.warningValue : undefined}>{value}</strong></div>;
}

function OrderPlaceholder({ type, pay, receive, onPay, onReceive }: { type: "limit" | "dca"; pay: Token; receive: Token; onPay: () => void; onReceive: () => void }) {
  const isLimit = type === "limit";
  return (
    <div className={styles.orderPanel}>
      <div className={styles.orderIntro}><span className={styles.orderIcon}>{isLimit ? <Info size={18} /> : <Clock3 size={18} />}</span><div><strong>{isLimit ? "Limit order" : "Dollar-cost averaging"}</strong><p>{isLimit ? "Set a target rate and execute only when the configured route reaches it." : "Split an order into recurring swaps on a schedule."}</p></div></div>
      <div className={styles.orderPair}><button onClick={onPay}><TokenIcon token={pay} size={28} />{pay.symbol}<ChevronDown size={15} /></button><ArrowDownUp size={17} /><button onClick={onReceive}><TokenIcon token={receive} size={28} />{receive.symbol}<ChevronDown size={15} /></button></div>
      <label className={styles.field}>{isLimit ? "Target rate" : "Amount per order"}<input inputMode="decimal" placeholder={isLimit ? `1 ${pay.symbol} = … ${receive.symbol}` : `0.00 ${pay.symbol}`} /></label>
      {!isLimit && <label className={styles.field}>Frequency<select defaultValue="weekly"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>}
      <button className={styles.primary} disabled>Coming with execution adapter</button>
      <p className={styles.adapterNote}>The UI is ready, but automated order execution remains disabled until the audited strategy/execution service is configured.</p>
    </div>
  );
}

function TokenSelector({ tokens, open, onClose, onSelect, onAddCustom }: { tokens: Token[]; open: boolean; onClose: () => void; onSelect: (token: Token) => void; onAddCustom: () => void }) {
  const [query, setQuery] = useState("");
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);
  useEffect(() => { if (!open) setQuery(""); }, [open]);
  const list = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tokens;
    return tokens.filter((token) => `${token.symbol} ${token.name} ${token.coinType ?? ""}`.toLowerCase().includes(normalized));
  }, [query, tokens]);
  if (!open) return null;

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="token-selector-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.modalTitle}><h2 id="token-selector-title">Select token</h2><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <label className={styles.search}><Search size={18} /><input data-autofocus placeholder="Search token or paste coin type" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className={styles.listLabel}>Available tokens</div>
        <div className={styles.tokenList}>
          {list.map((token) => <button key={`${token.symbol}-${token.coinType ?? token.name}`} onClick={() => onSelect(token)}><TokenIcon token={token} /><span><strong>{token.symbol}{token.verified && <Check size={13} />}</strong><small>{token.name}{!token.verified ? " · Unverified" : ""}</small></span><em>{token.balanceBaseUnits == null ? "—" : token.balanceBaseUnits === "0" ? "No balance" : formatTokenAmount(token.balanceText ?? "0", Math.min(token.decimals, 6))}</em></button>)}
          {!list.length && <div className={styles.emptySearch}>No token matches “{query}”.</div>}
        </div>
        <button className={styles.custom} onClick={onAddCustom}>+ Add custom token</button>
        <p className={styles.warning}><CircleAlert size={15} />Always verify the token address before trading. Only exact coin types in the operator-controlled trusted registry are marked verified.</p>
      </div>
    </div>
  );
}

function CustomTokenModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (token: Token) => void }) {
  const [coinType, setCoinType] = useState("");
  const [resolved, setResolved] = useState<Awaited<ReturnType<typeof resolveCustomToken>> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);
  useEffect(() => {
    if (!open) { setCoinType(""); setResolved(null); setError(""); setLoading(false); }
  }, [open]);
  if (!open) return null;

  async function lookup() {
    setLoading(true); setError(""); setResolved(null);
    try { setResolved(await resolveCustomToken(coinType.trim())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to import token."); }
    finally { setLoading(false); }
  }

  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="custom-token-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.modalTitle}><div><span className={styles.eyebrow}>Sui {PUBLIC_SUI_NETWORK[0].toUpperCase() + PUBLIC_SUI_NETWORK.slice(1)}</span><h2 id="custom-token-title">Add custom token</h2></div><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <label className={styles.field}>Token coin type<input value={coinType} onChange={(event) => setCoinType(event.target.value)} placeholder="0x...::module::COIN" autoComplete="off" /></label>
        <button className={styles.secondaryAction} disabled={loading || !coinType.trim()} onClick={lookup}>{loading ? "Resolving metadata…" : "Import token"}</button>
        {error && <p className={styles.warning}><CircleAlert size={15} />{error}</p>}
        {resolved && (
          <div className={styles.importPreview}>
            <Row label="Token" value={resolved.name} /><Row label="Symbol" value={resolved.symbol} /><Row label="Decimals" value={String(resolved.decimals)} /><Row label="Verified" value={resolved.verified ? "Yes — trusted coin type" : "No — unverified"} />
            {!resolved.verified && <p className={styles.warning}><CircleAlert size={15} />Metadata resolution does not prove token authenticity. Verify the coin type independently.</p>}
            <button className={styles.primary} onClick={() => onAdd({ symbol: resolved.symbol, name: resolved.name, decimals: resolved.decimals, verified: resolved.verified, balance: 0, priceUsd: 0, coinType: coinType.trim() })}>Add token</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsModal({ open, settings, maxSlippageBps, maxPriceImpactBps, onChange, onClose }: { open: boolean; settings: Settings; maxSlippageBps: number; maxPriceImpactBps: number; onChange: (settings: Settings) => void; onClose: () => void }) {
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);
  if (!open) return null;
  return (
    <div className={styles.backdrop} onMouseDown={onClose}>
      <div ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.modalTitle}><h2 id="settings-title">Swap settings</h2><button onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <label className={styles.field}>Slippage tolerance<div className={styles.unitInput}><input type="number" min="0.01" max={(maxSlippageBps / 100).toFixed(2)} step="0.01" value={(settings.slippageBps / 100).toFixed(2)} onChange={(event) => onChange({ ...settings, slippageBps: Math.max(1, Math.min(maxSlippageBps, Math.round(Number(event.target.value || 0) * 100))) })} /><span>%</span></div></label>
        <div className={styles.pills}>{[10, 50, 100].map((bps) => <button key={bps} className={settings.slippageBps === bps ? styles.selected : undefined} disabled={bps > maxSlippageBps} onClick={() => onChange({ ...settings, slippageBps: Math.min(bps, maxSlippageBps) })}>{(bps / 100).toFixed(2)}%</button>)}</div>
        <label className={styles.field}>Transaction deadline<div className={styles.unitInput}><input type="number" min="1" max="60" value={settings.deadlineMinutes} onChange={(event) => onChange({ ...settings, deadlineMinutes: Math.max(1, Math.min(60, Number(event.target.value || 20))) })} /><span>minutes</span></div></label>
        <div className={styles.routing}><strong>Routing</strong>{(["best-price", "lowest-impact", "custom"] as RoutingPreference[]).map((route) => <label key={route}><input type="radio" name="route" checked={settings.routing === route} onChange={() => onChange({ ...settings, routing: route })} /> {route === "best-price" ? "Best price" : route === "lowest-impact" ? "Lowest price impact" : "Custom"}</label>)}</div>
        <label className={styles.field}>Maximum price impact<div className={styles.unitInput}><input type="number" min="0.10" max={(maxPriceImpactBps / 100).toFixed(2)} step="0.10" value={(settings.maxPriceImpactBps / 100).toFixed(2)} onChange={(event) => onChange({ ...settings, maxPriceImpactBps: Math.max(10, Math.min(maxPriceImpactBps, Math.round(Number(event.target.value || 0) * 100))) })} /><span>%</span></div></label>
        <label className={styles.toggleRow}><span><strong>MEV / execution protection</strong><small>Require a fresh route, strict minimum output, deadline, and price-impact guard. Protected RPC is used only when configured by the deployment.</small></span><input type="checkbox" checked={settings.mevProtection} onChange={(event) => onChange({ ...settings, mevProtection: event.target.checked })} /></label>
        <label className={styles.toggleRow}><span><strong>Expert mode</strong><small>Allow routes with elevated price impact warnings. Minimum-output and quote-expiry checks still apply.</small></span><input type="checkbox" checked={settings.expertMode} onChange={(event) => onChange({ ...settings, expertMode: event.target.checked })} /></label>
      </div>
    </div>
  );
}

function Review({ open, quote, gasMist, amount, pay, receive, phase, error, digest, onClose, onConfirm }: { open: boolean; quote: Quote | null; gasMist: string | null; amount: string; pay: Token; receive: Token; phase: Phase; error: string | null; digest: string | null; onClose: () => void; onConfirm: () => Promise<void> }) {
  const canClose = phase !== "signing" && phase !== "submitted";
  const dialogRef = useDialogA11y<HTMLDivElement>(open && Boolean(quote), onClose, { closeOnEscape: canClose });
  if (!open || !quote) return null;
  return (
    <div className={styles.backdrop}>
      <div ref={dialogRef} tabIndex={-1} className={`${styles.modal} ${styles.reviewModal}`} role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div className={styles.modalTitle}><h2 id="review-title">Review swap</h2><button onClick={onClose} disabled={!canClose} aria-label="Close"><X size={18} /></button></div>
        <TransactionProgress phase={phase} />
        <div className={styles.reviewFlow}>
          <div><span>You pay</span><strong><TokenIcon token={pay} size={30} />{formatTokenAmount(amount, Math.min(pay.decimals, 6))} {pay.symbol}</strong><small>≈ {formatUsd((Number(amount) || 0) * pay.priceUsd)}</small></div>
          <ArrowDownUp size={18} />
          <div><span>You receive</span><strong><TokenIcon token={receive} size={30} />{quote.amountOutText} {receive.symbol}</strong><small>≈ {formatUsd(quote.amountOut * receive.priceUsd)}</small></div>
        </div>
        <div className={styles.details}><Row label="Rate" value={`1 ${pay.symbol} = ${fmt(quote.rate, 8)} ${receive.symbol}`} /><Row label="Price impact" value={`${quote.priceImpact.toFixed(2)}%`} /><Row label="Minimum received" value={`${quote.minimumReceivedText} ${receive.symbol}`} /><Row label="Service fee" value={`${quote.serviceFeeAmountText} ${pay.symbol} (${(quote.serviceFeeBps / 100).toFixed(2)}%)`} /><Row label="Sui network fee" value={gasMist ? `${formatTokenAmount(baseUnitsToDecimalString(BigInt(gasMist), 9), 9)} SUI simulated` : "Simulated before submission"} /><Row label="Route" value={quote.route.join(" → ")} /></div>
        <div className={styles.executionNotice}><Info size={16} /><span>The 2.5% JARVIS service fee is carved from the swap input and sent to the configured fee wallet atomically with the Cetus swap. Sui network gas is a separate protocol fee paid to the Sui network.</span></div>
        {error && <div className={styles.inlineError} role="alert"><CircleAlert size={16} />{error}</div>}
        {phase === "submitted" && digest && <div className={styles.inlineNotice} aria-live="polite"><Clock3 size={16} />Transaction submitted. Waiting for Sui confirmation…</div>}
        {phase === "confirmed" && digest && <div className={styles.inlineSuccess} aria-live="polite"><Check size={16} />Confirmed · <a href={explorerUrl(PUBLIC_SUI_NETWORK, digest)} target="_blank" rel="noreferrer">View on Suiscan ↗</a></div>}
        <div className={styles.reviewActions}><button onClick={onClose} disabled={!canClose}>{phase === "confirmed" ? "Close" : "Cancel"}</button>{phase !== "confirmed" && <button onClick={() => void onConfirm()} disabled={phase === "signing" || phase === "submitted"}>{phase === "signing" ? "Confirm in wallet…" : phase === "submitted" ? "Confirming on Sui…" : "Confirm swap"}</button>}</div>
      </div>
    </div>
  );
}

function TransactionProgress({ phase }: { phase: Phase }) {
  const stages = [
    { key: "review", label: "Review" },
    { key: "signing", label: "Sign" },
    { key: "submitted", label: "Submit" },
    { key: "confirmed", label: "Confirm" },
  ] as const;
  const activeIndex = phase === "confirmed" ? 3 : phase === "submitted" ? 2 : phase === "signing" ? 1 : 0;
  return <ol className={styles.progress} aria-label="Swap progress">{stages.map((stage, index) => <li key={stage.key} data-state={index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending"}><span>{index < activeIndex || phase === "confirmed" && index === 3 ? <Check size={12} /> : index + 1}</span><small>{stage.label}</small></li>)}</ol>;
}

function Recent() {
  const [items, setItems] = useState<SwapActivity[]>([]);
  const network = PUBLIC_SUI_NETWORK;
  useEffect(() => {
    const refresh = () => setItems(readSwapActivity().slice(0, 3));
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("jarvis-swap:activity-updated", refresh);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("jarvis-swap:activity-updated", refresh); };
  }, []);
  return (
    <section className={`card ${styles.recent}`}>
      <div className={styles.recentHeader}><h3>Recent swaps</h3><a href="/activity">View activity</a></div>
      {!items.length && <div className={styles.emptyRecent}>No swaps submitted from this browser yet.</div>}
      {items.map((item) => <div className={styles.recentRow} key={item.digest}><span>{item.status}</span><strong>{item.paySymbol} → {item.receiveSymbol}</strong><span>{item.amountIn} {item.paySymbol}</span><span>{formatTokenAmount(item.amountOut, 6)} {item.receiveSymbol}</span><a href={explorerUrl(network, item.digest)} target="_blank" rel="noreferrer">View ↗</a></div>)}
    </section>
  );
}
