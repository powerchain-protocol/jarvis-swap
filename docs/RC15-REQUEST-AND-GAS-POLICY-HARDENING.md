# JARVIS Swap rc.15 — Request and gas-policy hardening

The application version remains `1.0.0-rc.15`.

## Same-origin browser mutations

Versioned mutation routes reject requests that browser Fetch Metadata marks as `cross-site`. When an `Origin` header is present, it must match the application/request origin. Opaque `Origin: null` mutations are rejected. Requests without browser origin metadata remain usable by trusted non-browser clients, so CI and controlled server integrations are not forced into browser CSRF semantics.

This protection is applied before rate-limit/upstream work on swap quote/validate/verify, token import resolution, pool action validation, transaction preflight, and transaction execution.

## Transaction gas-budget policy

The relay parses the exact Sui transaction data before simulation/submission and now additionally rejects gas budgets above the configured deployment ceiling.

```env
JARVIS_MAX_GAS_BUDGET_MIST=2000000000
```

The default is 2 SUI. Operators should set a ceiling that covers their audited Cetus routes while remaining low enough to reject unexpectedly expensive or maliciously constructed transactions.

This guard is defense in depth. Wallet signature verification, Sui simulation, sender matching, command/input limits, publish/upgrade rejection, idempotent execution, and finality verification remain required.

## Fee settlement verified from simulation

For swap execution, validating the browser's persistence metadata is not sufficient. The final pre-submit Sui simulation is now inspected for the fee recipient's balance change. If the configured recipient does not receive the exact reviewed fee amount in the pay coin type, execution fails before submission.

This keeps Send/Receive generic—those calls do not carry swap persistence metadata—while preventing the swap relay from accepting a signed transaction that omits the configured service fee.
