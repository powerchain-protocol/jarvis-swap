export const BPS_DENOMINATOR = 10_000n;
export const MAX_SWAP_SERVICE_FEE_BPS = 250;

export function applyBps(amount: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) throw new RangeError("BPS must be an integer from 0 to 10000.");
  return (amount * BigInt(bps)) / BPS_DENOMINATOR;
}

export function splitServiceFee(amount: bigint, bps: number) {
  if (bps > MAX_SWAP_SERVICE_FEE_BPS) throw new RangeError("Service fee exceeds the JARVIS Swap maximum of 250 bps.");
  const fee = applyBps(amount, bps);
  return { gross: amount, fee, net: amount - fee };
}

export function minimumReceived(amountOut: bigint, slippageBps: number) {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps >= 10_000) throw new RangeError("Invalid slippage tolerance.");
  return (amountOut * BigInt(10_000 - slippageBps)) / BPS_DENOMINATOR;
}

export function rateFromPrices(payUsd: number, receiveUsd: number) {
  if (!(payUsd > 0) || !(receiveUsd > 0)) return null;
  return payUsd / receiveUsd;
}
