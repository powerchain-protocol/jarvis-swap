import "server-only";

import { MAX_SERVICE_FEE_BPS } from "@/constants/fees";
import { assertCoinType, normalizeSuiAddress } from "@/services/sui/address";
import { normalizeBalanceChanges } from "@/services/transactions/normalize";
import { AppError } from "@/utils/errors";
import { CANONICAL_SUI_COIN_TYPE } from "@/utils/tokens";
import { verifyQuoteClaims } from "@/services/quotes/integrity";

type PersistencePayload = {
  quoteId?: string;
  grossAmountInBaseUnits?: string;
  minimumOutBaseUnits?: string;
  serviceFeeBaseUnits?: string;
  serviceFeeBps?: number;
  payCoinType?: string;
  receiveCoinType?: string;
};

function positiveBigInt(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new AppError("BAD_REQUEST", `Invalid ${field}.`);
  const parsed = BigInt(value);
  if (parsed <= 0n) throw new AppError("BAD_REQUEST", `${field} must be positive.`);
  return parsed;
}

function nonNegativeBigInt(value: unknown, field: string): bigint {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw new AppError("BAD_REQUEST", `Invalid ${field}.`);
  const parsed = BigInt(value);
  if (parsed < 0n) throw new AppError("BAD_REQUEST", `${field} cannot be negative.`);
  return parsed;
}

export function validateSwapPersistencePayload(input: PersistencePayload, expectedFeeBps: number) {
  const gross = positiveBigInt(input.grossAmountInBaseUnits, "gross swap amount");
  const minimumOut = positiveBigInt(input.minimumOutBaseUnits, "minimum output");
  const serviceFee = nonNegativeBigInt(input.serviceFeeBaseUnits, "service fee");
  const feeBps = input.serviceFeeBps;

  if (!Number.isInteger(feeBps) || feeBps! < 0 || feeBps! > MAX_SERVICE_FEE_BPS || feeBps !== expectedFeeBps) {
    throw new AppError("BAD_REQUEST", "Persisted service-fee policy does not match the active deployment policy.");
  }

  const expectedFee = gross * BigInt(feeBps) / 10_000n;
  if (serviceFee !== expectedFee) throw new AppError("BAD_REQUEST", "Persisted service-fee amount is inconsistent with the gross input.");

  const quoteId = typeof input.quoteId === "string" ? input.quoteId.trim() : "";
  if (quoteId.length > 160) throw new AppError("BAD_REQUEST", "Invalid quote identifier.");

  const payCoinType = input.payCoinType ? assertCoinType(input.payCoinType, "pay coin type") : undefined;
  const receiveCoinType = input.receiveCoinType ? assertCoinType(input.receiveCoinType, "receive coin type") : undefined;
  if (payCoinType && receiveCoinType && payCoinType === receiveCoinType) {
    throw new AppError("BAD_REQUEST", "Persisted pay and receive coin types must be different.");
  }

  return {
    quoteId: quoteId || undefined,
    grossAmountInBaseUnits: gross.toString(),
    minimumOutBaseUnits: minimumOut.toString(),
    serviceFeeBaseUnits: serviceFee.toString(),
    serviceFeeBps: feeBps,
    payCoinType,
    receiveCoinType,
  };
}

export function validateSwapPersistenceAgainstQuote(
  quoteProof: unknown,
  persistenceInput: PersistencePayload,
  expectedFeeBps: number,
  expectedFeeRecipient?: string,
) {
  if (!quoteProof || typeof quoteProof !== "object" || Array.isArray(quoteProof)) {
    throw new AppError("BAD_REQUEST", "Signed quote proof is required for swap execution.");
  }
  const proof = quoteProof as Record<string, unknown>;
  const verified = verifyQuoteClaims(proof.claims, typeof proof.signature === "string" ? proof.signature : undefined);
  const claims = verified.claims;
  const persistence = validateSwapPersistencePayload(persistenceInput, expectedFeeBps);

  if (claims.serviceFeeBps !== expectedFeeBps) {
    throw new AppError("CONFLICT", "Signed quote service-fee policy no longer matches this deployment.", { status: 409 });
  }
  const expectedRecipient = expectedFeeRecipient ? normalizeSuiAddress(expectedFeeRecipient) : undefined;
  if ((claims.serviceFeeRecipient ?? undefined) !== expectedRecipient) {
    throw new AppError("CONFLICT", "Signed quote fee recipient no longer matches this deployment.", { status: 409 });
  }

  const mismatches: string[] = [];
  if ((persistence.quoteId ?? "") !== claims.id) mismatches.push("quoteId");
  if (persistence.grossAmountInBaseUnits !== claims.grossAmountInBaseUnits) mismatches.push("grossAmountInBaseUnits");
  if (persistence.minimumOutBaseUnits !== claims.minimumAmountOutBaseUnits) mismatches.push("minimumOutBaseUnits");
  if (persistence.serviceFeeBaseUnits !== claims.serviceFeeBaseUnits) mismatches.push("serviceFeeBaseUnits");
  if (persistence.serviceFeeBps !== claims.serviceFeeBps) mismatches.push("serviceFeeBps");
  if (persistence.payCoinType !== claims.payCoinType) mismatches.push("payCoinType");
  if (persistence.receiveCoinType !== claims.receiveCoinType) mismatches.push("receiveCoinType");
  if (mismatches.length) {
    throw new AppError("BAD_REQUEST", `Swap execution metadata does not match the signed quote (${mismatches.join(", ")}).`);
  }

  return { persistence, claims, signed: verified.signed };
}


/** Verify that the exact fresh Sui simulation includes the reviewed service-fee
 * credit. This prevents the generic execution boundary from recording a swap fee
 * that the signed PTB does not actually pay. Send/receive transactions omit the
 * persistence payload and therefore do not enter this check.
 */
export function assertSimulatedServiceFee(
  simulationRaw: unknown,
  persistence: ReturnType<typeof validateSwapPersistencePayload>,
  feeRecipient: string | undefined,
) {
  const expected = BigInt(persistence.serviceFeeBaseUnits);
  if (expected === 0n) return;
  if (!feeRecipient) throw new AppError("CONFIGURATION_ERROR", "Service-fee recipient is not configured.");
  if (!persistence.payCoinType) throw new AppError("BAD_REQUEST", "Swap fee coin type is required.");

  const recipient = normalizeSuiAddress(feeRecipient);
  const coinType = assertCoinType(persistence.payCoinType, "pay coin type");
  const raw = simulationRaw && typeof simulationRaw === "object" && !Array.isArray(simulationRaw)
    ? simulationRaw as Record<string, unknown>
    : {};
  const changes = normalizeBalanceChanges(raw.balanceChanges);

  let credited = 0n;
  for (const change of changes) {
    if (!change.owner) continue;
    let owner: string;
    let candidateCoinType: string;
    try {
      owner = normalizeSuiAddress(change.owner);
      candidateCoinType = assertCoinType(change.coinType, "balance-change coin type");
    } catch {
      continue;
    }
    if (owner !== recipient || candidateCoinType !== coinType) continue;
    try {
      const amount = BigInt(change.amountBaseUnits);
      if (amount > 0n) credited += amount;
    } catch {
      // Ignore malformed upstream entries; missing exact credit fails below.
    }
  }

  if (credited !== expected) {
    throw new AppError("FORBIDDEN", "Simulated transaction does not pay the exact JARVIS service fee.", { status: 422 });
  }
}


/** Verify the user-facing swap outcome from the exact fresh simulation.
 *
 * The service-fee check alone is insufficient: a malicious or accidentally
 * malformed PTB could pay the fee wallet correctly while sending the routed
 * output somewhere other than the connected wallet. This guard requires the
 * signed transaction simulation to credit the sender with at least the
 * reviewed minimum output in the exact receive coin type.
 */
export function assertSimulatedSwapOutcome(
  simulationRaw: unknown,
  persistence: ReturnType<typeof validateSwapPersistencePayload>,
  senderInput: string,
  feeRecipient: string | undefined,
  gasUsedMist: bigint = 0n,
) {
  assertSimulatedServiceFee(simulationRaw, persistence, feeRecipient);

  if (!persistence.receiveCoinType) {
    throw new AppError("BAD_REQUEST", "Swap receive coin type is required for execution validation.");
  }

  const sender = normalizeSuiAddress(senderInput);
  const receiveCoinType = assertCoinType(persistence.receiveCoinType, "receive coin type");
  const minimumOut = BigInt(persistence.minimumOutBaseUnits);
  const raw = simulationRaw && typeof simulationRaw === "object" && !Array.isArray(simulationRaw)
    ? simulationRaw as Record<string, unknown>
    : {};
  const changes = normalizeBalanceChanges(raw.balanceChanges);

  let netReceiveDelta = 0n;
  for (const change of changes) {
    if (!change.owner) continue;
    let owner: string;
    let candidateCoinType: string;
    try {
      owner = normalizeSuiAddress(change.owner);
      candidateCoinType = assertCoinType(change.coinType, "balance-change coin type");
    } catch {
      continue;
    }
    if (owner !== sender || candidateCoinType !== receiveCoinType) continue;
    try {
      netReceiveDelta += BigInt(change.amountBaseUnits);
    } catch {
      // Malformed upstream entries cannot satisfy the minimum-output invariant.
    }
  }

  // When the receive asset is SUI, the sender's balance delta also includes the
  // transaction gas debit. Add the simulated gas back before comparing against
  // the reviewed swap minimum. For non-SUI outputs no gas adjustment applies.
  const canonicalSui = assertCoinType(CANONICAL_SUI_COIN_TYPE, "SUI coin type");
  const receivedBeforeGas = receiveCoinType === canonicalSui
    ? netReceiveDelta + (gasUsedMist > 0n ? gasUsedMist : 0n)
    : netReceiveDelta;

  if (receivedBeforeGas < minimumOut) {
    throw new AppError(
      "FORBIDDEN",
      "Simulated transaction does not credit the connected wallet with the reviewed minimum output.",
      { status: 422 },
    );
  }

  return { receivedBeforeGasBaseUnits: receivedBeforeGas.toString(), minimumOutBaseUnits: minimumOut.toString() };
}
