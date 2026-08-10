export type FeePolicy = {
  serviceFeeBps: number;
  recipient?: string;
  recipientStatus: "configured" | "tba";
  maximumBps: 250;
  networkFeeAsset: "SUI";
  networkFeeRecipient: "Sui network";
};

export type NetworkFeeEstimate = {
  asset: "SUI";
  mist: string;
  suiText: string;
  source: "simulation";
  recipient: "Sui network";
};

export type ServiceFeeCharge = {
  bps: number;
  baseUnits: string;
  amountText: string;
  coinType: string;
  recipient?: string;
  recipientStatus: "configured" | "tba";
};

export type FeeBreakdown = {
  grossBaseUnits: string;
  serviceFeeBaseUnits: string;
  netSwapBaseUnits: string;
  serviceFeeBps: number;
  serviceFeeRecipient?: string;
  grossText?: string;
  serviceFeeText?: string;
  netSwapText?: string;
  networkGasKnown: boolean;
  networkGasMist?: string;
  networkGasText?: string;
  totalWalletDebitBaseUnits?: string;
  totalWalletDebitText?: string;
  networkFeeRecipient: "Sui network";
};
