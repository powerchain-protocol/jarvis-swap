# RC15 simulated swap outcome hardening

Version remains `1.0.0-rc.15`.

## Why this exists

Verifying the 2.5% service-fee credit is necessary but not sufficient. A malformed
or malicious programmable transaction could still pay the fee wallet correctly
while routing the swap output to an unexpected address.

## New invariant

For swap transactions, both preflight and final execution simulation now require:

1. the exact configured service-fee credit in the pay asset;
2. the connected sender to receive at least the reviewed `minimumOutBaseUnits`;
3. that output credit to use the exact reviewed receive coin type.

The browser sends the same bounded persistence intent to preflight and execution,
and the server independently validates that intent before inspecting Sui balance
changes.

This is defense-in-depth. The wallet signature is still required, the transaction
policy still rejects unsafe PTBs, and the execution endpoint re-simulates the
exact signed bytes immediately before submission.
