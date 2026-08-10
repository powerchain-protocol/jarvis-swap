import { baseUnitsToDecimalString } from "./service-fee";
import type { FeeBreakdown } from "@/types/fees";
import { assertCoinType } from "@/services/sui/address";
import { CANONICAL_SUI_COIN_TYPE } from "@/utils/tokens";

export function buildFeeBreakdown(input: {
  grossBaseUnits: bigint;
  serviceFeeBaseUnits: bigint;
  netSwapBaseUnits: bigint;
  serviceFeeBps: number;
  serviceFeeRecipient?: string;
  payDecimals: number;
  paySymbol: string;
  payCoinType?: string;
  networkGasMist?: bigint;
}): FeeBreakdown {
  const gas = input.networkGasMist;
  const totalSuiDebit = gas == null ? undefined : totalSuiDebitBaseUnits({
    payCoinType: input.payCoinType ?? "",
    grossBaseUnits: input.grossBaseUnits,
    networkGasMist: gas,
  });
  return {
    grossBaseUnits: input.grossBaseUnits.toString(),
    serviceFeeBaseUnits: input.serviceFeeBaseUnits.toString(),
    netSwapBaseUnits: input.netSwapBaseUnits.toString(),
    serviceFeeBps: input.serviceFeeBps,
    serviceFeeRecipient: input.serviceFeeRecipient,
    grossText: `${baseUnitsToDecimalString(input.grossBaseUnits, input.payDecimals)} ${input.paySymbol}`,
    serviceFeeText: `${baseUnitsToDecimalString(input.serviceFeeBaseUnits, input.payDecimals)} ${input.paySymbol}`,
    netSwapText: `${baseUnitsToDecimalString(input.netSwapBaseUnits, input.payDecimals)} ${input.paySymbol}`,
    networkGasKnown: gas != null,
    networkGasMist: gas?.toString(),
    networkGasText: gas == null ? undefined : `${baseUnitsToDecimalString(gas, 9)} SUI`,
    totalWalletDebitBaseUnits: totalSuiDebit?.toString(),
    totalWalletDebitText: totalSuiDebit == null ? undefined : `${baseUnitsToDecimalString(totalSuiDebit, 9)} SUI`,
    networkFeeRecipient: "Sui network",
  };
}

export function totalSuiDebitBaseUnits(input: { payCoinType: string; grossBaseUnits: bigint; networkGasMist: bigint }) {
  // The service fee is carved out of grossAmountIn; it is NOT added on top.
  // Sui gas is always an additional SUI network charge.
  let payCoinType: string;
  try { payCoinType = assertCoinType(input.payCoinType, "pay coin type"); }
  catch { return input.networkGasMist; }
  const suiCoinType = assertCoinType(CANONICAL_SUI_COIN_TYPE, "SUI coin type");
  return payCoinType === suiCoinType
    ? input.grossBaseUnits + input.networkGasMist
    : input.networkGasMist;
}
