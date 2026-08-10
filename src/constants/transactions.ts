/** Defensive limits for transactions submitted through the JARVIS relay boundary.
 * These are intentionally generous enough for aggregator PTBs while preventing the
 * API from becoming an unrestricted simulation/execution relay for arbitrarily
 * complex transactions.
 */
export const MAX_JARVIS_TRANSACTION_BYTES = 300_000;
export const MAX_JARVIS_TRANSACTION_COMMANDS = 512;
export const MAX_JARVIS_TRANSACTION_INPUTS = 1_024;

/** JARVIS Swap/Send never needs package publication or upgrade commands. */
export const FORBIDDEN_JARVIS_TRANSACTION_COMMANDS = new Set(["Publish", "Upgrade"]);
