export type PoolRangeState = "in-range" | "below-range" | "above-range" | "unknown";

export type PoolSummary = {
  id: string;
  exists: boolean;
  type: string | null;
  version: string | null;
  coinTypeA: string | null;
  coinTypeB: string | null;
  feeRate: string | null;
  tickSpacing?: string | null;
  currentTickIndex?: number | null;
  currentSqrtPrice: string | null;
  liquidity: string | null;
};

export type PoolPosition = {
  objectId: string;
  version?: string | null;
  poolObjectId?: string | null;
  type?: string | null;
  tickLower?: number | null;
  tickUpper?: number | null;
  liquidity?: string | null;
  feeOwedA?: string | null;
  feeOwedB?: string | null;
  rewardOwed?: string[];
  rangeState: PoolRangeState;
  currentTickIndex?: number | null;
  lastTransaction?: string | null;
  raw?: unknown;
};

export type PoolActionKind = "open-position" | "add-liquidity" | "remove-liquidity" | "collect-fees" | "collect-rewards" | "close-position";
export type PoolActionIntent = {
  kind: PoolActionKind;
  owner: string;
  poolObjectId: string;
  positionObjectId?: string;
  tickLower?: number;
  tickUpper?: number;
  amountABaseUnits?: string;
  amountBBaseUnits?: string;
  liquidity?: string;
  slippageBps?: number;
};
