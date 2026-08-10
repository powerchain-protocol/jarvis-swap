import "server-only";
import { normalizeSuiAddress } from "@/services/sui/address";
import { listBalancesGrpc } from "@/services/sui/grpc";

export type SuiBalance = { coinType: string; coinObjectCount: number; totalBalance: string; coinBalance?: string; addressBalance?: string; lockedBalance?: Record<string, string> };

export async function fetchWalletBalances(address: string) {
  const owner = normalizeSuiAddress(address);
  const balances = await listBalancesGrpc(owner) as SuiBalance[];
  return { address: owner, transport: "grpc" as const, balances };
}

export async function fetchWalletCoinBalance(address: string, coinType: string) {
  const owner = normalizeSuiAddress(address);
  const data = await fetchWalletBalances(owner);
  return data.balances.find((balance) => balance.coinType === coinType) ?? { coinType, coinObjectCount: 0, totalBalance: "0" };
}
