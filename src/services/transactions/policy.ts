import "server-only";
import { Transaction } from "@mysten/sui/transactions";
import { FORBIDDEN_JARVIS_TRANSACTION_COMMANDS, MAX_JARVIS_TRANSACTION_COMMANDS, MAX_JARVIS_TRANSACTION_INPUTS } from "@/constants/transactions";
import { normalizeSuiAddress } from "@/services/sui/address";
import { AppError } from "@/utils/errors";
import { getServerConfig } from "@/config/env";

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function commandKind(value: unknown): string | undefined {
  const command = record(value);
  if (!command) return undefined;
  if (typeof command.$kind === "string") return command.$kind;
  const keys = Object.keys(command);
  return keys.length === 1 ? keys[0] : undefined;
}

export type TransactionPolicyResult = {
  sender: string;
  commandCount: number;
  inputCount: number;
  commandKinds: string[];
  gasBudgetMist?: string;
};

/** Parse the exact BCS bytes that will be simulated/submitted and enforce the
 * JARVIS transaction-relay policy before consuming upstream execution resources.
 * This does not replace Sui signature verification or simulation; it narrows the
 * relay to ordinary programmable transactions built for Swap/Send flows.
 */
export function assertJarvisTransactionPolicy(bytes: Uint8Array, expectedSender: string): TransactionPolicyResult {
  let data: unknown;
  try {
    data = Transaction.from(bytes).getData();
  } catch {
    throw new AppError("BAD_REQUEST", "Transaction bytes are not valid Sui transaction data.");
  }

  const tx = record(data) ?? {};
  const senderRaw = typeof tx.sender === "string" ? tx.sender : "";
  if (!senderRaw) throw new AppError("BAD_REQUEST", "Transaction sender is missing.");
  const sender = normalizeSuiAddress(senderRaw);
  const expected = normalizeSuiAddress(expectedSender);
  if (sender !== expected) throw new AppError("BAD_REQUEST", "Transaction sender does not match the connected wallet.");

  const commands = Array.isArray(tx.commands) ? tx.commands : [];
  const inputs = Array.isArray(tx.inputs) ? tx.inputs : [];
  if (commands.length === 0) throw new AppError("BAD_REQUEST", "Transaction contains no commands.");
  if (commands.length > MAX_JARVIS_TRANSACTION_COMMANDS) throw new AppError("BAD_REQUEST", "Transaction contains too many commands.", { status: 413 });
  if (inputs.length > MAX_JARVIS_TRANSACTION_INPUTS) throw new AppError("BAD_REQUEST", "Transaction contains too many inputs.", { status: 413 });

  const kinds = commands.map(commandKind).filter((kind): kind is string => Boolean(kind));
  if (kinds.some((kind) => FORBIDDEN_JARVIS_TRANSACTION_COMMANDS.has(kind))) {
    throw new AppError("FORBIDDEN", "Package publish/upgrade transactions are not accepted by the JARVIS execution relay.");
  }

  const gasData = record(tx.gasData);
  const gasBudgetRaw = gasData?.budget;
  let gasBudgetMist: bigint | undefined;
  if (typeof gasBudgetRaw === "bigint") gasBudgetMist = gasBudgetRaw;
  else if (typeof gasBudgetRaw === "number" && Number.isSafeInteger(gasBudgetRaw) && gasBudgetRaw >= 0) gasBudgetMist = BigInt(gasBudgetRaw);
  else if (typeof gasBudgetRaw === "string" && /^\d+$/.test(gasBudgetRaw)) gasBudgetMist = BigInt(gasBudgetRaw);
  if (gasBudgetMist !== undefined) {
    const maximum = BigInt(getServerConfig().maxGasBudgetMist);
    if (gasBudgetMist <= 0n) throw new AppError("BAD_REQUEST", "Transaction gas budget must be positive.");
    if (gasBudgetMist > maximum) throw new AppError("FORBIDDEN", "Transaction gas budget exceeds the JARVIS execution policy.");
  }

  const gasOwnerRaw = gasData && typeof gasData.owner === "string" ? gasData.owner : undefined;
  if (gasOwnerRaw && normalizeSuiAddress(gasOwnerRaw) !== expected) {
    throw new AppError("BAD_REQUEST", "Sponsored gas owners are not supported by this execution boundary.");
  }

  return { sender, commandCount: commands.length, inputCount: inputs.length, commandKinds: kinds, gasBudgetMist: gasBudgetMist?.toString() };
}
