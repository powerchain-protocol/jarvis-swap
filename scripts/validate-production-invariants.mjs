import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

const pkg = JSON.parse(read("package.json"));
if (pkg.version !== "1.0.0-rc.15") failures.push(`Version changed unexpectedly: ${pkg.version}`);

const feeConstants = read("src/constants/fees.ts");
if (!/MAX_SERVICE_FEE_BPS\s*=\s*250\b/.test(feeConstants)) failures.push("Service-fee hard cap must remain 250 bps.");

const feeService = read("src/services/fees/service-fee.ts");
if (!feeService.includes("MAX_SERVICE_FEE_BPS")) failures.push("Fee calculation must enforce the canonical service-fee cap.");

const swapUi = read("src/components/swap/swap-interface.tsx");
if (/quotes\/mock|Demo quote/.test(swapUi)) failures.push("Production swap UI must not import/demo-label mock quotes.");

if (fs.existsSync(path.join(root, "src/services/quotes/mock.ts"))) failures.push("Mock quote implementation must not ship in the production source tree.");

const registry = read("src/services/tokens/registry.ts");
if (/balance:\s*(?!0\b)\d|priceUsd:\s*(?!0\b)\d/.test(registry)) failures.push("Bootstrap token registry must not contain fabricated live balances/prices.");


const quoteRoute = read("src/app/api/v1/swap/quote/route.ts");
if (/networkFee:\s*0\.0012/.test(quoteRoute)) failures.push("Quote API must not ship a fabricated static Sui network fee.");
if (!quoteRoute.includes("readJson<QuoteBody>") || !quoteRoute.includes("32_000")) failures.push("Quote API must use bounded JSON parsing.");

const cacheUtil = read("src/utils/cache.ts");
if (!cacheUtil.includes("MAX_CACHE_ENTRIES") || !cacheUtil.includes("pruneExpired")) failures.push("In-memory cache must be bounded and prune expired entries.");

const rateLimit = read("src/services/security/rate-limit.ts");
if (!rateLimit.includes("windowMs") || !rateLimit.includes("ratelimit-policy")) failures.push("Rate-limit headers must preserve the configured window duration.");

const idempotency = read("src/services/security/idempotency.ts");
if (!idempotency.includes("acquireIdempotency") || !idempotency.includes("PROCESSING_STATUS")) failures.push("Transaction idempotency must reserve keys before Sui submission.");
const executeRoute = read("src/app/api/v1/transactions/execute/route.ts");
if (!executeRoute.includes("Idempotency-Key is required") || !executeRoute.includes("acquireIdempotency")) failures.push("Transaction execution must require and atomically acquire an idempotency key.");
if (!executeRoute.includes("simulateTransactionGrpc") || !executeRoute.includes("verifyTransactionSignature")) failures.push("Transaction execution must verify signatures and re-simulate before submission.");
if (!executeRoute.includes("assertJarvisTransactionPolicy(bytes, sender)")) failures.push("Transaction execution must apply the JARVIS relay policy before signature verification/submission.");

const txPolicy = read("src/services/transactions/policy.ts");
if (!txPolicy.includes("Transaction.from(bytes).getData()") || !txPolicy.includes("Transaction sender does not match")) failures.push("Execution relay must parse exact transaction bytes and verify the encoded sender.");
if (!txPolicy.includes("FORBIDDEN_JARVIS_TRANSACTION_COMMANDS.has(kind)")) failures.push("JARVIS execution relay must reject package publish/upgrade commands.");
if (!txPolicy.includes("Transaction contains too many commands") || !txPolicy.includes("Sponsored gas owners are not supported")) failures.push("Execution relay must bound PTB complexity and reject unsupported gas sponsorship.");
const preflightRoute = fs.readFileSync(path.join(root, "src/app/api/v1/transactions/preflight/route.ts"), "utf8");
if (!preflightRoute.includes("readJson<PreflightBody>")) failures.push("Transaction preflight must use bounded request parsing.");
if (!preflightRoute.includes("decodeBase64Strict") || !preflightRoute.includes("assertJarvisTransactionPolicy")) failures.push("Preflight must strictly decode and policy-check the exact transaction bytes.");
if (!preflightRoute.includes("parseTransactionEnvelope")) failures.push("Transaction preflight must use the shared Sui envelope parser.");
const txStatusRoute = fs.readFileSync(path.join(root, "src/app/api/v1/transactions/[digest]/route.ts"), "utf8");
if (!txStatusRoute.includes('enforceRateLimit(request, "tx-status"')) failures.push("Transaction status polling must be rate limited.");
const sendService = fs.readFileSync(path.join(root, "src/services/transfers/send.ts"), "utf8");
if (!sendService.includes("assertCoinType(input.token.coinType")) failures.push("Send flow must validate the transfer coin type before building a transaction.");


const aggregator = fs.readFileSync(path.join(root, "src/services/cetus/aggregator.ts"), "utf8");
if (!aggregator.includes("withCircuitBreaker") || !aggregator.includes("cetusQuoteTimeoutMs")) failures.push("Cetus quotes must use timeout/circuit-breaker protection.");
const persistenceValidation = fs.readFileSync(path.join(root, "src/services/transactions/persistence-validation.ts"), "utf8");
if (!persistenceValidation.includes("expectedFee") || !persistenceValidation.includes("expectedFeeBps")) failures.push("Swap persistence metadata must validate exact fee policy and amount.");
const quoteRouteHardened = fs.readFileSync(path.join(root, "src/app/api/v1/swap/quote/route.ts"), "utf8");
if (quoteRouteHardened.includes("const amountIn = Number(amountText)")) failures.push("Quote validation must not use floating point as the primary amount-validity gate.");

const tokenResolve = read("src/app/api/v1/tokens/resolve/route.ts");
if (tokenResolve.includes("request.json()") || !tokenResolve.includes("readJson<ResolveTokenBody>") || !tokenResolve.includes('enforceRateLimit(request, "token-resolve"')) failures.push("Custom-token resolution must use bounded parsing and rate limiting.");
if (!tokenResolve.includes('url.protocol === "https:"')) failures.push("Custom-token remote icons must be restricted to HTTPS.");
const walletProvider = read("src/components/wallet/wallet-provider.tsx");
if (walletProvider.includes("signAndExecuteTransaction")) failures.push("Wallet provider must not expose direct client-side sign-and-execute; guarded server execution is required.");
const objectShapes = read("src/services/sui/object-shapes.ts");
if (!objectShapes.includes("normalizeSuiObject") || !objectShapes.includes("unknown")) failures.push("Sui object responses must be runtime-normalized from unknown data.");


if (!read("src/services/quotes/integrity.ts").includes("priceImpactBps")) failures.push("Signed quote must bind price impact.");
if (!read("src/services/transactions/execute.ts").includes("Signed quote price impact does not match")) failures.push("Execution must verify signed price impact.");
if (!read("src/app/api/v1/swap/quote/route.ts").includes("Pay and receive tokens must be different")) failures.push("Quote API must reject same-asset swaps.");
if (!read("src/utils/api-client.ts").includes("apiErrorMessage")) failures.push("Client API errors must preserve structured server messages.");
if (!read("src/services/quotes/client.ts").includes("amountIn: request.amountIn")) failures.push("Quote client must preserve exact decimal input text.");
if (!read("src/services/quotes/client.ts").includes("isQuote(payload)")) failures.push("Quote client must runtime-validate quote responses.");

const suiGrpc = read("src/services/sui/grpc.ts");
if (!suiGrpc.includes("assertSuiGrpcNetwork") || !suiGrpc.includes("network mismatch")) failures.push("Sui transaction execution must fail closed on a reported network mismatch.");
if (!suiGrpc.includes("withGrpcTimeout")) failures.push("Sui gRPC reads must use bounded timeout protection.");
if (!suiGrpc.includes("createSuiExecutionGrpcClient") || !suiGrpc.includes("config.protectedRpcUrl ?? config.grpcUrl")) failures.push("Configured protected Sui RPC must be used by the transaction submission path.");
if (!suiGrpc.includes("asRecord(await withGrpcTimeout") || !suiGrpc.includes("Sui gRPC returned an invalid reference gas price")) failures.push("Sui Core/gRPC response envelopes must be narrowed from unknown before field access.");
if (!aggregator.includes('network === "devnet"') || !aggregator.includes("unexpected input amount")) failures.push("Cetus routing must reject Devnet and exact-input amount mismatches.");
if (!aggregator.includes("deterministicQuoteId") || !aggregator.includes('createHash("sha256")')) failures.push("Fallback Cetus quote IDs must be deterministic SHA-256 commitments.");
if (!feeService.includes("baseUnitsToDecimalString")) failures.push("Exact base-unit to decimal-string formatting is required for blockchain amount presentation.");
if (!quoteRoute.includes("amountOutText") || !quoteRoute.includes("minimumReceivedText") || !quoteRoute.includes("serviceFeeAmountText")) failures.push("Quote responses must expose exact decimal-string token amounts.");
const clientExecute = read("src/services/transactions/execute.ts");
if (!clientExecute.includes('config.network === "devnet"')) failures.push("Client transaction construction must fail closed for Cetus swaps on Devnet.");
if (!swapUi.includes("swapExecutionEnabled") || !swapUi.includes("Cetus swaps are unavailable on Sui Devnet")) failures.push("Swap UI must expose and enforce the Devnet Cetus execution gate.");
if (!swapUi.includes("truncateDecimalText(quote.amountOutText") || !swapUi.includes("formatTokenAmount(item.amountOut")) failures.push("Swap direction/activity display must not round exact quote amounts through Number.");


const fetchJson = read("src/common/fetch-json.ts");
if (!fetchJson.includes("retryableMethod") || !fetchJson.includes("retryAfterMs") || !fetchJson.includes("parentSignal")) failures.push("Shared HTTP client must preserve caller cancellation and avoid unsafe/non-retryable retries.");
const realtimeSocket = read("src/services/realtime/websocket.ts");
if (!realtimeSocket.includes("parseRealtimeEnvelope") || !realtimeSocket.includes("256 * 1024") || !realtimeSocket.includes("lastSequenceByTopic")) failures.push("Realtime frames must be bounded, runtime-validated, and sequence-deduplicated.");
const storageUtil = read("src/utils/storage.ts");
if (!storageUtil.includes("maxChars") || !storageUtil.includes("readStorageJson")) failures.push("Client persistence must use bounded localStorage JSON parsing.");
if (!swapUi.includes("compareUnsignedDecimalText") || !swapUi.includes("isPositiveDecimalText")) failures.push("Swap input/balance validity must use decimal-text checks before presentation-only Number conversion.");

const quoteIntegrity = read("src/services/quotes/integrity.ts");
if (!quoteIntegrity.includes("parseSignedQuoteClaims") || !quoteIntegrity.includes("net + fee !== gross")) failures.push("Signed quote verification must runtime-validate exact quote arithmetic.");
if (!quoteIntegrity.includes("claims.routing") || !quoteIntegrity.includes("claims.deadlineMinutes")) failures.push("Signed quotes must bind routing and transaction deadline settings.");
if (!quoteRoute.includes("requestedMaxPriceImpactBps") || !quoteRoute.includes("effectiveMaxPriceImpactBps")) failures.push("Quote creation must bind the user's price-impact protection to the signed quote.");
const walletClient = read("src/services/wallet/client.ts");
if (!walletClient.includes("balanceText") || !walletClient.includes("balanceBaseUnits") || !walletClient.includes("baseUnitsToDecimalString")) failures.push("Wallet hydration must preserve exact base-unit and decimal-text balances.");
if (!swapUi.includes("Boolean(accountAddress && balancesLoaded)") || !swapUi.includes("subtractUnsignedDecimalText")) failures.push("Swap balance checks must use hydrated exact decimal spendable balances without treating bootstrap zeroes as live data.");

if (fs.existsSync(path.join(root, "tsconfig.tsbuildinfo"))) failures.push("TypeScript incremental build artifacts must not ship in the source archive.");
const tsconfig = JSON.parse(read("tsconfig.json"));
if (tsconfig.compilerOptions?.incremental && tsconfig.compilerOptions?.tsBuildInfoFile !== ".next/cache/typescript/tsconfig.tsbuildinfo") failures.push("TypeScript incremental metadata must be written under .next cache, not the repository root.");


const sendTransfer = read("src/services/transfers/send.ts");
const safeActions = read("src/utils/safe-actions.ts");
const proxySource = read("src/proxy.ts");
if (!executeRoute.includes("decodeBase64Strict") || !executeRoute.includes("assertEncodedSignature")) failures.push("Transaction execution must strictly validate encoded bytes/signatures before verification.");
if (!sendTransfer.includes("0x2::balance::send_funds") || !sendTransfer.includes("tx.balance")) failures.push("Send flow must use the current address-balance transfer path.");
if (!safeActions.includes("Content-Type must be application/json")) failures.push("Bounded JSON actions must reject explicitly non-JSON request bodies.");
if (!proxySource.includes("requestIdFrom") || !proxySource.includes("{8,128}")) failures.push("Proxy must bound and validate caller-supplied request IDs.");
if (fs.existsSync(path.join(root, "tsconfig.tsbuildinfo"))) failures.push("Release archive must not include stale tsconfig.tsbuildinfo output.");


const analyticsPage = read("src/app/analytics/page.tsx");
if (analyticsPage.includes("SWAP_VOLUME") || analyticsPage.includes("$12.45M")) failures.push("Production analytics UI must not present illustrative market metrics as live telemetry.");
if (!fs.existsSync(path.join(root, "src/components/shell/mobile-dock.tsx"))) failures.push("Responsive production shell must include the mobile navigation dock.");
if (swapUi.includes("<span className={styles.eyebrow}>Sui Mainnet</span>")) failures.push("Custom-token UI must follow the configured Sui network instead of hard-coding Mainnet.");
if (!swapUi.includes("assertCoinType(left.coinType) === assertCoinType(right.coinType)")) failures.push("Swap token identity must compare canonical coin types when available.");
if (!swapUi.includes("amount={amount}") || swapUi.includes("quote={quote} amount={numericAmount}")) failures.push("Swap review must preserve the exact user-entered decimal amount string.");

const dialogHook = read("src/hooks/use-dialog.ts");
if (!dialogHook.includes("bodyLockCount") || !dialogHook.includes("event.key !== \"Tab\"") || !dialogHook.includes("previousFocus")) failures.push("Production dialogs must trap focus, restore focus, and use a safe shared scroll lock.");
if (!swapUi.includes("quoteRequestId") || !swapUi.includes("requestId !== quoteRequestId.current")) failures.push("Swap quotes must reject stale out-of-order responses.");
if (!swapUi.includes("policyLimits.maxSlippageBps") || !swapUi.includes("policyLimits.maxPriceImpactBps")) failures.push("Stored swap settings must remain capped by deployment policy.");
const sendReceivePanel = read("src/components/services/send-receive-panel.tsx");
if (!sendReceivePanel.includes("isPositiveDecimalText(amount)") || !sendReceivePanel.includes("closeOnEscape: !busy")) failures.push("Send UX must use exact decimal validation and remain non-dismissible during active execution.");
if (!swapUi.includes("TransactionProgress") || !swapUi.includes('aria-label="Swap progress"')) failures.push("Swap review must expose transaction progress without equating submission with confirmation.");

if (failures.length) {
  console.error("Production invariant validation failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

// rc.15 API/UI consolidation
const legacyQuote = read("src/app/api/quote/route.ts");
const legacyTokenResolve = read("src/app/api/tokens/resolve/route.ts");
if (!read("src/services/quotes/client.ts").includes("API_ROUTES.quote")) failures.push("Quote client must use the versioned API route constant.");
if (!read("src/services/tokens/import-token.ts").includes("API_ROUTES.tokenResolve")) failures.push("Token import client must use the versioned API route constant.");
if (!legacyQuote.includes("deprecation") || !legacyTokenResolve.includes("deprecation")) failures.push("Legacy API aliases must advertise their versioned successors.");
if (!fs.existsSync(path.join(root, "src/components/shared/page-state.tsx"))) failures.push("Professional async pages must share consistent loading/empty/error states.");

// rc.15 resilience/data hardening
const statusBanner = read("src/components/shell/system-status-banner.tsx");
if (!statusBanner.includes("useOnlineStatus") || !statusBanner.includes("useRpc")) failures.push("Global degraded/offline status UX must remain wired.");
const priceValidation = read("src/services/prices/validation.ts");
if (!priceValidation.includes("parsePythPayload") || !priceValidation.includes("parseBirdeyePayload") || !priceValidation.includes("parseCoinGeckoPayload")) failures.push("External market data must remain runtime validated.");
const networkStatusHook = read("src/hooks/use-network-status.ts");
if (!networkStatusHook.includes("parseNetworkStatus") || !networkStatusHook.includes("visibilitychange") || !networkStatusHook.includes("activeController")) failures.push("Sui network polling must validate payloads and suspend/abort stale checks.");


if (!persistenceValidation.includes("assertSimulatedServiceFee") || !persistenceValidation.includes("credited !== expected")) failures.push("Swap execution must verify the exact service-fee credit in fresh Sui simulation effects.");
if (!read("src/app/api/v1/transactions/execute/route.ts").includes("assertSimulatedSwapOutcome(simulation.raw")) failures.push("Transaction execution must enforce simulated service-fee and minimum-output settlement before submission.");

// rc.15 request-origin and gas-budget hardening
const requestSecurity = read("src/services/security/request-security.ts");
const transactionPolicy = read("src/services/transactions/policy.ts");
if (!requestSecurity.includes("sec-fetch-site") || !requestSecurity.includes("Request origin is not allowed")) failures.push("Unsafe browser mutation endpoints must reject explicit cross-site origins.");
for (const route of [
  "src/app/api/v1/transactions/execute/route.ts",
  "src/app/api/v1/transactions/preflight/route.ts",
  "src/app/api/v1/swap/quote/route.ts",
  "src/app/api/v1/swap/verify/route.ts",
  "src/app/api/v1/swap/validate/route.ts",
  "src/app/api/v1/tokens/resolve/route.ts",
  "src/app/api/v1/pools/actions/validate/route.ts",
]) {
  if (!read(route).includes("assertMutationRequest(request)")) failures.push(`${route} must enforce mutation request origin metadata.`);
}
if (!transactionPolicy.includes("maxGasBudgetMist") || !transactionPolicy.includes("gas budget exceeds")) failures.push("Transaction relay must enforce a configurable maximum gas budget.");
if (!read("src/config/env.ts").includes("JARVIS_MAX_GAS_BUDGET_MIST")) failures.push("Maximum relay gas budget must be environment-configurable.");


// rc.15 notification and accessibility UX
const toastProvider = read("src/components/shared/toast-provider.tsx");
const appProviders = read("src/context/app-providers.tsx");
const settingsPage = read("src/app/settings/page.tsx");
if (!toastProvider.includes("aria-live=\"polite\"") || !toastProvider.includes("MAX_TOASTS = 4")) failures.push("Global notifications must remain accessible and bounded.");
if (!appProviders.includes("<ToastProvider>")) failures.push("ToastProvider must remain mounted at the application provider boundary.");
if (!settingsPage.includes('aria-pressed={theme === "light"}') || !settingsPage.includes('aria-pressed={preferences.fiatCurrency === "USD"}')) failures.push("Segmented settings controls must expose pressed state to assistive technology.");

// rc.15 trading UX polish
const storageKeys = read("src/constants/storage.ts");
const formatsUtil = read("src/utils/formats.ts");
if (!storageKeys.includes("swapWorkspace")) failures.push("Swap pair/tab continuity must use the bounded shared workspace storage key.");
if (!formatsUtil.includes("scaleUnsignedDecimalText") || !formatsUtil.includes("BigInt(numerator)")) failures.push("Quick balance percentages must use exact bigint-backed decimal scaling.");
if (!swapUi.includes("showQuickAmounts={Boolean(accountAddress && balancesLoaded)}") || !swapUi.includes("scaleUnsignedDecimalText(maxValue")) failures.push("Connected swap UX must retain exact 25/50/75/MAX quick amounts.");
if (!swapUi.includes("setQuoteRefreshKey((value) => value + 1)") || !swapUi.includes('aria-label="Refresh quote"')) failures.push("Swap quote summary must retain an explicit fresh-route action.");
if (!swapUi.includes("WORKSPACE_KEY") || !swapUi.includes("writeStorageJson(WORKSPACE_KEY")) failures.push("Selected trading pair and order tab must be restored with bounded local persistence.");

if (failures.length) {
  console.error("Production invariant validation failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Production invariants: PASS");


// rc.15 storage, wallet-network, and activity-route hardening
const themeProvider = read("src/components/shared/theme-provider.tsx");
const walletProviderHardened = read("src/components/wallet/wallet-provider.tsx");
const walletActivityRoute = read("src/app/api/v1/wallet/[address]/activity/route.ts");
if (!storageUtil.includes("readStorageString") || !storageUtil.includes("writeStorageString") || !storageUtil.includes("removeStorage")) failures.push("Browser string persistence must use safe shared storage helpers.");
if (!themeProvider.includes("STORAGE_KEYS.theme") || !themeProvider.includes("restored.current")) failures.push("Theme persistence must use the canonical key and avoid the initial hydration write race.");
if (!walletProviderHardened.includes("account.chains.includes(SUI_CHAIN)") || walletProviderHardened.includes("account.chains.some((chain) => chain.startsWith(\"sui:\")) ?? null")) failures.push("Wallet connection must require an account on the exact configured Sui chain.");
if (!walletProviderHardened.includes("reconnectAttempted.current")) failures.push("Silent wallet reconnect must be bounded to one attempt per provider lifecycle.");
if (!walletActivityRoute.includes("apiErrorResponse") || !walletActivityRoute.includes("requireInteger") || !walletActivityRoute.includes("optionalCursor")) failures.push("Wallet activity must use structured errors and bounded pagination inputs.");

if (failures.length) {
  console.error("Production invariant validation failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Storage/wallet/activity invariants: PASS");


// rc.15 wallet session / fee / market-data hardening
const sessionServer = read("src/services/session/server.ts");
const walletProviderSession = read("src/components/wallet/wallet-provider.tsx");
const swapConfigSession = read("src/app/api/v1/swap/config/route.ts");
const ratesService = read("src/services/rates/index.ts");
if (!sessionServer.includes("verifyPersonalMessageSignature") || !sessionServer.includes("SameSite=Strict") || !sessionServer.includes("wallet-challenge")) failures.push("Wallet sessions must use personal-message verification and strict HTTP-only signed cookies.");
if (!read("src/app/api/v1/transactions/execute/route.ts").includes("assertWalletSession(request, sender)") || !read("src/app/api/v1/transactions/preflight/route.ts").includes("assertWalletSession(request, sender)")) failures.push("Protected transaction routes must bind required wallet sessions to the transaction sender.");
if (!walletProviderSession.includes('features["sui:signPersonalMessage"]') || !walletProviderSession.includes("connectAndVerify")) failures.push("Wallet connection UX must support Wallet Standard personal-message session verification.");
if (!swapConfigSession.includes('feeWalletStatus: config.feeWallet ? "configured" : "tba"') || !swapConfigSession.includes('networkFeeRecipient: "Sui network"')) failures.push("Swap configuration must distinguish TBA service-fee wallet from Sui network gas.");
if (!ratesService.includes("fetchMarketRate") || !ratesService.includes("fetchBestPrice")) failures.push("Market conversion rates must derive from validated price providers rather than static values.");
if (!swapUi.includes("balancesLoaded") || !swapUi.includes("No {token.symbol} balance") || !swapUi.includes("Balance: —")) failures.push("Swap UI must not present bootstrap zero balances as live wallet data.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Wallet session/fees/market-data invariants: PASS");

// rc.15 session-origin / exact-rate / fee-summary hardening
const sessionOriginHardened = read("src/services/session/server.ts");
const feeServiceHardened = read("src/services/fees/service-fee.ts");
const feeSummaryHardened = read("src/services/fees/summary.ts");
if (!sessionOriginHardened.includes("claims.origin !== configuredOrigin()") || !sessionOriginHardened.includes("Origin: ${claims.origin}")) failures.push("Wallet session challenges and sessions must be bound to the configured application origin.");
const swapDomainService = read("src/services/swap.ts");
if (quoteRoute.includes("rate: Number(amountText)") || (!quoteRoute.includes("rate: quote.rate") && !quoteRoute.includes("baseUnitRatioToNumber")) || !swapDomainService.includes("baseUnitRatioToNumber")) failures.push("Displayed quote rates must derive from exact bigint base units rather than Number(amountText).");
if (!feeServiceHardened.includes("baseUnitRatioToNumber") || !feeServiceHardened.includes("numeratorBaseUnits")) failures.push("Exact base-unit rate derivation helper is required.");
if (!feeSummaryHardened.includes("totalWalletDebitBaseUnits") || !feeSummaryHardened.includes("totalSuiDebitBaseUnits")) failures.push("Fee summary must distinguish service fee from total SUI wallet debit including network gas.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Session origin/rate/fee invariants: PASS");


// rc.15 shared wallet-data and cancellation-safe cache hardening
const walletDataHook = read("src/hooks/use-wallet-data.ts");
const walletClientShared = read("src/services/wallet/client.ts");
const pricesClientShared = read("src/services/prices/client.ts");
const cacheShared = read("src/utils/cache.ts");
const walletButtonShared = read("src/components/wallet/wallet-button.tsx");
const sendReceiveShared = read("src/components/services/send-receive-panel.tsx");
if (!cacheShared.includes("withAbortSignal") || !cacheShared.includes('signal.addEventListener("abort"')) failures.push("Shared client caches must let each consumer cancel its own wait without aborting the deduplicated request.");
if (!walletClientShared.includes("withAbortSignal(shared, signal)") || walletClientShared.includes('fetch(API_ROUTES.wallet(address), { cache: "no-store", signal })')) failures.push("Wallet request deduplication must not bind caller-owned AbortSignal state to the shared in-flight fetch.");
if (!pricesClientShared.includes("withAbortSignal(shared, signal)") || pricesClientShared.includes('fetch(`${API_ROUTES.prices}?${query}`, { cache: "no-store", signal })')) failures.push("Price request deduplication must not let one caller abort shared market-data work.");
if (!walletDataHook.includes('jarvis-swap:transaction-confirmed') || !walletDataHook.includes('jarvis-swap:realtime-wallet') || !walletDataHook.includes("REFRESH_INTERVAL_MS")) failures.push("Wallet data must refresh after confirmed transactions, realtime hints, and bounded foreground polling.");
if (!walletButtonShared.includes("useWalletData(accountAddress)") || !walletButtonShared.includes("No SUI balance")) failures.push("Wallet account UX must show hydrated SUI balance state without presenting bootstrap zero as live data.");
if (!sendReceiveShared.includes('useWalletData(mode === "send" ? accountAddress : null)') || !sendReceiveShared.includes("walletData.refresh(true)")) failures.push("Send must reuse the shared wallet-data lifecycle and refresh immediately after Sui finality.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Wallet data/cache resilience invariants: PASS");

// rc.15 routing/network configuration hardening
const envConfigRouting = read("src/config/env.ts");
const cetusAggregatorRouting = read("src/services/cetus/aggregator.ts");
const swapReadinessService = read("src/services/system/readiness.ts");
if (!envConfigRouting.includes('selectedNetwork === "mainnet"') || !envConfigRouting.includes('SUI_USDC_COIN_TYPE')) failures.push("Mainnet USDC must not silently default on Testnet/Devnet.");
if (!envConfigRouting.includes('deepBookPoolIds = csv("DEEPBOOK_POOL_IDS").map((value) => normalizeSuiAddress(value))') || !envConfigRouting.includes('cetusPoolIds = csv("CETUS_POOL_IDS").map((value) => normalizeSuiAddress(value))')) failures.push("Configured pool IDs must be validated as Sui object IDs.");
if (!cetusAggregatorRouting.includes("resolveProviders") || !cetusAggregatorRouting.includes("not allowed by deployment policy")) failures.push("Cetus routing must enforce the deployment provider allowlist inside the adapter.");
if (!swapReadinessService.includes("JARVIS_SWAP_FEE_WALLET is TBA") || !swapReadinessService.includes("executionEnabled")) failures.push("Swap readiness must report TBA fee-wallet and execution blockers without crashing read-only config.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Routing/network configuration invariants: PASS");

// rc.15 RPC cluster / trusted-token hardening
const clusterTypes = read("src/types/clusters.ts");
const grpcLayer = read("src/services/sui/grpc.ts");
const trustedTokens = read("src/data/trusted-token-list.ts");
const trustedResolver = read("src/services/tokens/trusted.ts");
const tokenResolveRoute = read("src/app/api/v1/tokens/resolve/route.ts");
if (!clusterTypes.includes('"custom"') || !envConfigRouting.includes("NEXT_PUBLIC_SUI_CLUSTER") || !envConfigRouting.includes("SUI_CUSTOM_GRPC_URL")) failures.push("Sui cluster configuration must support explicit mainnet/testnet/devnet/custom profiles.");
if (!envConfigRouting.includes("SUI_GRPC_URLS") || !grpcLayer.includes("withGrpcReadFailover") || !grpcLayer.includes("assertGrpcClientNetwork")) failures.push("Sui gRPC reads must support ordered endpoint failover with per-endpoint network identity checks.");
if (!trustedTokens.includes("userImportedTokensTrusted: false") || !trustedResolver.includes("getTrustedTokenList")) failures.push("Token verification must come from the operator-controlled exact coin-type trusted registry.");
if (!tokenResolveRoute.includes("resolveTrustedToken") || !tokenResolveRoute.includes('verificationSource: token.verified ? "trusted-list" : "unverified"')) failures.push("Custom token resolution must distinguish exact trusted-list matches from unverified metadata.");
if (!read("src/services/tokens/registry.ts").includes('symbol: "JARVIS"') || read("src/services/tokens/registry.ts").match(/symbol: "JARVIS"[\s\S]{0,180}verified: true/)) failures.push("Deployment-specific bootstrap tokens must not be pre-marked verified before exact coin types are loaded.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("RPC cluster/trusted-token invariants: PASS");

// rc.15 RPC endpoint health / trusted-registry conflict hardening
const rpcHealth = read("src/services/sui/rpc-health.ts");
const networkStatusRoute = read("src/app/api/v1/network/status/route.ts");
if (!grpcLayer.includes("rankRpcEndpoints") || !grpcLayer.includes("recordRpcFailure") || !grpcLayer.includes("recordRpcSuccess")) failures.push("Sui gRPC read failover must rank healthy endpoints, quarantine failures, and restore them after success.");
if (!rpcHealth.includes("openUntil") || !rpcHealth.includes("consecutiveFailures") || !rpcHealth.includes("retryAfterMs")) failures.push("RPC endpoint health must track bounded quarantine state and expose sanitized retry timing.");
if (!networkStatusRoute.includes("rpcHealth: getGrpcReadHealth()")) failures.push("Network status must expose sanitized RPC pool health for operator/user diagnostics.");
if (!envConfigRouting.includes("SUI_RPC_FAILURE_THRESHOLD") || !envConfigRouting.includes("SUI_RPC_COOLDOWN_MS") || !envConfigRouting.includes('validateGrpcUrl(protectedRpcRaw, "SUI_PROTECTED_RPC_URL"')) failures.push("RPC health policy and protected execution URL must be validated from environment configuration.");
if (!trustedTokens.includes("RESERVED_SYMBOLS") || !trustedTokens.includes("cannot override reserved symbol") || !trustedTokens.includes("maps to more than one coin type")) failures.push("Trusted token registry must reject reserved-symbol overrides and conflicting aliases.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("RPC health/trusted-registry invariants: PASS");


// rc.15 RPC ranking / canonical trusted-token / configured cache-window hardening
const rpcHealthRanking = read("src/services/sui/rpc-health.ts");
const trustedRegistry = read("src/data/trusted-token-list.ts");
const trustedService = read("src/services/tokens/trusted.ts");
const portfolioValuation = read("src/services/portfolio/valuation.ts");
if (!rpcHealthRanking.includes("EWMA_ALPHA") || !rpcHealthRanking.includes("rankRpcEndpoints") || !rpcHealthRanking.includes("preferred")) failures.push("RPC reads must use health/latency ranking with a preferred endpoint signal.");
if (!grpcLayer.includes("assertReportedChainId") || !grpcLayer.includes("chainIdByNetwork") || !grpcLayer.includes("normalizeReportedNetwork")) failures.push("Sui RPC identity must bind both normalized network name and chain ID across endpoints.");
if (!trustedRegistry.includes("canonicalCoinType") || !trustedRegistry.includes("assertCoinType") || !trustedService.includes("getTrustedTokenRegistryId")) failures.push("Trusted-token entries must use canonical Sui coin types and expose a deterministic registry fingerprint.");
if (!portfolioValuation.includes("config.portfolioCacheTtlMs")) failures.push("Portfolio cache TTL must honor PORTFOLIO_CACHE_TTL_MS.");
if (!rateLimit.includes("apiRateLimitWindowMs") || !rateLimit.includes("effectiveWindowMs")) failures.push("Default API rate-limit windows must honor API_RATE_LIMIT_WINDOW_MS.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("RPC ranking/trust/cache invariants: PASS");

// rc.15 environment/build gate consistency
const envValidator = read("scripts/validate-env.mjs");
const buildProduction = read("scripts/build-production.mjs");
const packageJsonText = read("package.json");
if (!envValidator.includes('strictProduction') || !envValidator.includes('requireWhenProduction') || !envValidator.includes('--production')) failures.push("Environment validation must separate structural checks from fail-closed production checks.");
if (!buildProduction.includes("['scripts/validate-env.mjs', '--production']")) failures.push("Production builds must run strict production environment validation before Next.js build.");
if (!packageJsonText.includes('validate:env:production')) failures.push("package.json must expose a strict production environment validation command.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Environment/build gate invariants: PASS");

// rc.15 RPC pool summary / trusted metadata hydration hardening
const trustedMetadataHydration = read("src/services/tokens/trusted-metadata.ts");
const trustedApiRoute = read("src/app/api/v1/tokens/trusted/route.ts");
if (!rpcHealthRanking.includes("rpcPoolHealthSummary") || !networkStatusRoute.includes("rpcPool: rpcPoolHealthSummary(endpoints)")) failures.push("RPC status must expose an aggregate pool quality summary in addition to per-endpoint health.");
if (!trustedMetadataHydration.includes("getCoinMetadataGrpc") || !trustedMetadataHydration.includes("MAX_CONCURRENCY") || !trustedMetadataHydration.includes('metadataStatus: "resolved"')) failures.push("Trusted-token display metadata must hydrate from Sui with bounded concurrency while keeping registry trust separate.");
if (!trustedApiRoute.includes('if-none-match') || !trustedApiRoute.includes('status: 304') || !trustedApiRoute.includes('representationId')) failures.push("Trusted-token registry responses must support deterministic ETag revalidation.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("RPC pool/token metadata invariants: PASS");


// rc.15 canonical asset identity / market-price safety
const priceTypesIdentity = read("src/services/prices/types.ts");
const pricesClientIdentity = read("src/services/prices/client.ts");
const walletClientIdentity = read("src/services/wallet/client.ts");
const pricesRouteIdentity = read("src/app/api/v1/prices/route.ts");
if (!priceTypesIdentity.includes("coinType?: string") || !read("src/services/prices/index.ts").includes("canonicalCoinType")) failures.push("Price observations must retain canonical Sui coin-type identity when available.");
if (!pricesClientIdentity.includes("byCoinType") || !pricesClientIdentity.includes("token.verified") || !pricesClientIdentity.includes("preventing a user-imported token")) failures.push("Client market-price application must prefer exact coin type and forbid symbol-only pricing for unverified tokens.");
if (!walletClientIdentity.includes("parseWalletData") || !walletClientIdentity.includes("assertCoinType") || !walletClientIdentity.includes("balances.length > 5_000")) failures.push("Wallet payloads must be bounded, runtime-validated and canonicalized before entering client state.");
if (!pricesRouteIdentity.includes('enforceRateLimit(request, "prices", 120)') || !pricesRouteIdentity.includes('error: "Price unavailable"')) failures.push("Public price API must be abuse-limited and avoid leaking detailed upstream/provider errors.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Asset identity/price safety invariants: PASS");

const quoteIntegrityLatest = read("src/services/quotes/integrity.ts");
const quoteRouteLatest = read("src/app/api/v1/swap/quote/route.ts");
const swapDomainLatest = read("src/services/swap.ts");
const swapExecutionLatest = read("src/services/transactions/execute.ts");
if (!quoteIntegrityLatest.includes("routeCommitment") || !quoteIntegrityLatest.includes("amountOutBaseUnits") || !quoteIntegrityLatest.includes("claims.network !== config.network")) failures.push("Signed quote claims must bind network, exact output, and route commitment.");
if (!swapDomainLatest.includes("createRouteCommitment") || !swapDomainLatest.includes('createHash("sha256")')) failures.push("Authoritative swap quotes must create a deterministic SHA-256 route commitment.");
if (!quoteRouteLatest.includes("routeCommitment: quote.routeCommitment") || !quoteRouteLatest.includes("amountOutBaseUnits: quote.amountOutBaseUnits.toString()")) failures.push("Quote API must sign exact output and route commitment.");
if (!swapExecutionLatest.includes("routeAmountIn !== fee.netSwapAmount") || !swapExecutionLatest.includes("proof.network !== network")) failures.push("Execution must enforce exact fresh-route input and signed network binding.");
// rc.15 upstream admission control
const concurrencyGuard = read("src/services/security/concurrency.ts");
const portfolioRouteCapacity = read("src/app/api/v1/portfolio/[address]/route.ts");
const pricesRouteCapacity = read("src/app/api/v1/prices/route.ts");
const envCapacity = read("src/config/env.ts");
if (!concurrencyGuard.includes("withConcurrencyBudget") || !concurrencyGuard.includes("state.queue.length >= queueLimit") || !concurrencyGuard.includes("Server is at capacity")) failures.push("Expensive upstream work must retain bounded per-runtime concurrency and queue admission control.");
if (!quoteRouteLatest.includes('withConcurrencyBudget(') || !quoteRouteLatest.includes('"swap-quote-upstream"')) failures.push("Swap quote upstream work must remain behind the concurrency budget.");
if (!portfolioRouteCapacity.includes('"portfolio-upstream"') || !pricesRouteCapacity.includes('"prices-upstream"')) failures.push("Portfolio and price upstream work must remain behind concurrency budgets.");
if (!envCapacity.includes("API_QUOTE_CONCURRENCY") || !envCapacity.includes("API_REQUEST_QUEUE_LIMIT") || !envCapacity.includes("API_REQUEST_QUEUE_WAIT_MS")) failures.push("Concurrency budgets must remain environment configurable.");

if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Quote route/network commitment invariants: PASS");
console.log("Upstream admission-control invariants: PASS");

if (!quoteIntegrityLatest.includes("decodeBase64Strict") || !quoteIntegrityLatest.includes('label: "quote signature"')) failures.push("Quote signatures must use strict bounded base64url decoding before timing-safe verification.");
const swaggerLatest = read("src/app/api/swagger.yaml");
if (!swaggerLatest.includes("routeCommitment") || !swaggerLatest.includes("QuoteResponse:")) failures.push("OpenAPI must document signed quote route commitments and exact-output claims.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }

// RC15 swap-outcome invariants: the service-fee credit alone is not enough.
{
  const persistence = read("src/services/transactions/persistence-validation.ts");
  const preflight = read("src/app/api/v1/transactions/preflight/route.ts");
  const execute = read("src/app/api/v1/transactions/execute/route.ts");
  if (!persistence.includes("assertSimulatedSwapOutcome")) failures.push("Swap outcome simulation guard is required.");
  if (!persistence.includes("receiveCoinType")) failures.push("Swap persistence must bind the receive coin type.");
  if (!persistence.includes("receivedBeforeGas < minimumOut")) failures.push("Simulation must enforce minimum received with SUI gas normalization.");
  if (!preflight.includes("assertSimulatedSwapOutcome")) failures.push("Preflight must enforce simulated swap outcome.");
  if (!execute.includes("assertSimulatedSwapOutcome")) failures.push("Execution must re-enforce simulated swap outcome.");
  if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
}

console.log("Quote encoding/OpenAPI invariants: PASS");




// rc.15 server-bound quote execution: browser persistence is never authoritative.
{
  const persistence = read("src/services/transactions/persistence-validation.ts");
  const preflightClient = read("src/services/transactions/preflight.ts");
  const swapExecution = read("src/services/transactions/execute.ts");
  const preflightRoute = read("src/app/api/v1/transactions/preflight/route.ts");
  const executeRoute = read("src/app/api/v1/transactions/execute/route.ts");
  const swagger = read("src/app/api/swagger.yaml");
  if (!persistence.includes("validateSwapPersistenceAgainstQuote") || !persistence.includes("verifyQuoteClaims")) failures.push("Swap persistence must be derived from a server-verified signed quote proof.");
  if (!persistence.includes("Swap execution metadata does not match the signed quote")) failures.push("Server must reject persistence fields that diverge from signed quote claims.");
  if (!preflightClient.includes("quoteProof") || !swapExecution.includes("quoteProof")) failures.push("Swap client must send the signed quote proof to both preflight and execution.");
  if (!preflightRoute.includes("Signed quote proof is required for swap preflight") || !executeRoute.includes("Signed quote proof is required for swap execution")) failures.push("Transaction APIs must fail closed when swap persistence arrives without a quote proof.");
  if (!swagger.includes("SwapQuoteProof:") || !swagger.includes("Required whenever SwapExecutionPersistence is supplied")) failures.push("OpenAPI must document the server-bound quote proof requirement.");
  if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
  
const tradeAssetSource = read("src/services/tokens/trade-asset.ts");
const quoteRouteSource = read("src/app/api/v1/swap/quote/route.ts");
const quoteIntegritySource = read("src/services/quotes/integrity.ts");
if (!tradeAssetSource.includes("getCoinMetadataGrpc") || !tradeAssetSource.includes("Sui coin metadata")) failures.push("Server-authoritative token decimals resolver is required.");
if (!quoteRouteSource.includes("resolveTradeAssetMetadata") || !quoteRouteSource.includes("Token metadata changed")) failures.push("Quote route must resolve and compare Sui token decimals server-side.");
if (!quoteIntegritySource.includes("payDecimals") || !quoteIntegritySource.includes("receiveDecimals")) failures.push("Signed quotes must bind server-resolved token decimals.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Server-bound quote execution invariants: PASS");
}

// rc.15 readiness / RPC policy / canonical fee accounting
const rpcPolicy = read("src/services/sui/rpc-policy.ts");
const readinessRouteHardened = read("src/app/api/v1/ready/route.ts");
const readinessServiceHardened = read("src/services/system/readiness.ts");
const feeSummaryCanonical = read("src/services/fees/summary.ts");
if (!rpcPolicy.includes("public-good Sui endpoint") || !rpcPolicy.includes("protectedRpcUrl")) failures.push("Dedicated Mainnet RPC policy must cover the full read pool and protected submission endpoint.");
if (!readinessServiceHardened.includes("dedicatedRpcViolations") || !readinessServiceHardened.includes("endpointCount")) failures.push("Swap readiness must report and enforce dedicated RPC policy across the configured pool.");
if (!readinessRouteHardened.includes("assertDatabaseReadyWhenRequired") || !readinessRouteHardened.includes("databasePersistenceEnabled") || !readinessRouteHardened.includes("DATABASE_PERSISTENCE_ENABLED=true requires DATABASE_URL")) failures.push("Production readiness must verify PostgreSQL and fail closed when durable persistence is enabled without DATABASE_URL.");
if (!feeSummaryCanonical.includes("assertCoinType(input.payCoinType") || !feeSummaryCanonical.includes("CANONICAL_SUI_COIN_TYPE")) failures.push("SUI total-debit accounting must compare canonical coin types rather than raw strings.");
if (!feeSummaryCanonical.includes("networkGasKnown") || !feeSummaryCanonical.includes("netSwapText")) failures.push("Fee breakdown must distinguish gross input, net routed input, and simulated network gas state.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Readiness/RPC/fee-accounting invariants: PASS");

// Wallet-session replay/cookie hardening.
{
  const sessionServer = fs.readFileSync(path.join(root, "src/services/session/server.ts"), "utf8");
  const sessionVerify = fs.readFileSync(path.join(root, "src/app/api/v1/session/verify/route.ts"), "utf8");
  const walletProvider = fs.readFileSync(path.join(root, "src/components/wallet/wallet-provider.tsx"), "utf8");
  if (!sessionServer.includes("__Host-") || !sessionServer.includes("walletChallengeReplayKey")) failures.push("Production wallet sessions must use host-scoped cookies and deterministic challenge replay keys.");
  if (!sessionVerify.includes("acquireIdempotency(replayKey") || !sessionVerify.includes("completeIdempotency(replayKey")) failures.push("Wallet verification challenges must be single-use/reserved before verification.");
  if (!sessionVerify.includes("releaseIdempotency(replayKey")) failures.push("Failed wallet verification must release a still-processing challenge reservation.");
  if (!walletProvider.includes("session.expiresAt - Date.now()") || !walletProvider.includes('window.addEventListener("online"')) failures.push("Wallet session UI must refresh at expiry and after connectivity restoration.");
  if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
  console.log("Wallet session replay/cookie invariants: PASS");
}


// rc.15 upstream failure isolation / circuit-breaker observability
{
  const breaker = read("src/services/upstream/circuit-breaker.ts");
  const priceIndex = read("src/services/prices/index.ts");
  const cetusAggregator = read("src/services/cetus/aggregator.ts");
  const deployment = read("src/services/system/deployment.ts");
  const env = read("src/config/env.ts");
  if (!breaker.includes("isRetryableUpstreamFailure") || !breaker.includes('state: "closed" | "open" | "half-open"')) failures.push("Circuit breakers must classify availability failures and expose bounded state snapshots.");
  if (!breaker.includes("status === 429") || !breaker.includes("status >= 500") || !breaker.includes('message.includes("not configured")')) failures.push("Deterministic client/configuration errors must not poison upstream circuits.");
  if (!priceIndex.includes('`price-${provider}`') || !priceIndex.includes("withCircuitBreaker")) failures.push("Each market-data provider must be isolated behind its own circuit breaker.");
  if (!cetusAggregator.includes("upstreamFailureThreshold") || !cetusAggregator.includes("upstreamCooldownMs")) failures.push("Cetus routing must use the deployment circuit-breaker policy.");
  if (!deployment.includes("circuitBreakerSnapshot") || !deployment.includes('"price-pyth"') || !deployment.includes('"cetus-aggregator"')) failures.push("Deployment diagnostics must expose secret-free circuit state for known upstreams.");
  if (!env.includes("UPSTREAM_FAILURE_THRESHOLD") || !env.includes("UPSTREAM_COOLDOWN_MS")) failures.push("Circuit-breaker threshold and cooldown must be environment configurable.");
  if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
  console.log("Upstream circuit-breaker resilience invariants: PASS");
}

// rc.15 structured observability / runtime capacity
const observabilityLogger = read("src/services/observability/logger.ts");
const deploymentRuntime = read("src/services/system/deployment.ts");
if (!observabilityLogger.includes("REDACTED_KEYS") || !observabilityLogger.includes("requestCorrelationId") || !observabilityLogger.includes("errorClass")) failures.push("Structured operational logs must redact sensitive fields and retain request correlation without raw errors.");
if (!read("src/app/api/v1/swap/quote/route.ts").includes("swap.quote.created") || !read("src/app/api/v1/transactions/execute/route.ts").includes("transaction.submitted")) failures.push("High-value quote and execution routes must emit structured correlated operational events.");
if (!deploymentRuntime.includes('concurrencySnapshot("swap-quote-upstream")') || !deploymentRuntime.includes('concurrencySnapshot("portfolio-upstream")') || !deploymentRuntime.includes('concurrencySnapshot("prices-upstream")')) failures.push("Deployment diagnostics must expose secret-free runtime admission utilization.");
if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
console.log("Observability/runtime-capacity invariants: PASS");


// rc.15 operational swap kill switch: fail closed without disabling Send/Receive.
{
  const operations = read("src/services/system/operations.ts");
  const readiness = read("src/services/system/readiness.ts");
  const quote = read("src/app/api/v1/swap/quote/route.ts");
  const preflight = read("src/app/api/v1/transactions/preflight/route.ts");
  const execute = read("src/app/api/v1/transactions/execute/route.ts");
  const configRoute = read("src/app/api/v1/swap/config/route.ts");
  const env = read("src/config/env.ts");
  if (!operations.includes("assertSwapOperationsEnabled") || !operations.includes("SERVICE_UNAVAILABLE")) failures.push("Swap operational kill switch must fail closed with a service-unavailable boundary.");
  if (!env.includes('JARVIS_SWAP_OPERATIONS_ENABLED')) failures.push("Operational swap kill switch must be environment configurable.");
  if (!readiness.includes("getSwapOperationsState")) failures.push("Swap readiness must include the operator kill-switch state.");
  if (!quote.includes("assertSwapOperationsEnabled(config)")) failures.push("Quote creation must stop when swap operations are disabled.");
  if (!preflight.includes("if (body.persistence) assertSwapOperationsEnabled(config)")) failures.push("Swap preflight must stop when swap operations are disabled while non-swap preflight remains available.");
  if (!execute.includes("if (body.persistence) assertSwapOperationsEnabled(config)")) failures.push("Swap execution must stop before idempotent submission when swap operations are disabled.");
  if (!configRoute.includes("swapOperationsEnabled") || !configRoute.includes("swapOperationsReason")) failures.push("Public swap config must expose secret-free operator availability state.");
  if (failures.length) { console.error("Production invariant validation failed:\n- " + failures.join("\n- ")); process.exit(1); }
  console.log("Operational swap kill-switch invariants: PASS");
}
