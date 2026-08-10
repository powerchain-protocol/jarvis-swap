"use client";

import { Transaction } from "@mysten/sui/transactions";
import { assertCoinType, normalizeSuiAddress } from "@/services/sui/address";
import { decimalToBaseUnits } from "@/services/fees/service-fee";
import { executeSignedTransaction, preflightSignedTransaction, type TransactionPreflight } from "@/services/transactions/preflight";
import { waitForSwapConfirmation } from "@/services/transactions/status";
import type { SendIntent, SendResult } from "@/types/transfers";

export async function sendSuiAsset(input: SendIntent & {
  signTransaction: (transaction: Transaction) => Promise<{ bytes: string; signature: string }>;
  onPreflight?: (preflight: TransactionPreflight) => void;
}): Promise<SendResult> {
  const sender = normalizeSuiAddress(input.sender);
  const recipient = normalizeSuiAddress(input.recipient);
  if (sender === recipient) throw new Error("Recipient must be different from the connected wallet.");
  const coinType = assertCoinType(input.token.coinType, "transfer coin type");
  if (!Number.isInteger(input.token.decimals) || input.token.decimals < 0 || input.token.decimals > 18) throw new Error("Token decimals are invalid.");
  const amount = decimalToBaseUnits(input.amount, input.token.decimals);
  if (amount <= 0n) throw new Error("Transfer amount must be greater than zero.");

  const tx = new Transaction();
  tx.setSender(sender);
  // Prefer address-balance delivery: it works with both address balances and
  // coin objects as funding sources and avoids forcing a recipient Coin<T>
  // object when the recipient only needs the fungible balance.
  tx.moveCall({
    target: "0x2::balance::send_funds",
    typeArguments: [coinType],
    arguments: [
      tx.balance({ balance: amount, type: coinType }),
      tx.pure.address(recipient),
    ],
  });

  const signed = await input.signTransaction(tx);
  const preflight = await preflightSignedTransaction({ bytes: signed.bytes, sender });
  input.onPreflight?.(preflight);
  const result = await executeSignedTransaction({
    bytes: signed.bytes,
    signature: signed.signature,
    sender,
    idempotencyKey: crypto.randomUUID(),
  });
  await waitForSwapConfirmation(result.digest);
  return { digest: result.digest, gasUsedMist: preflight.gasUsedMist };
}
