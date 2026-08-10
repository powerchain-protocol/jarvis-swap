# JARVIS Swap rc.15 — Transaction Policy & Settings Hardening

The version remains `1.0.0-rc.15`.

## Execution relay policy

The preflight and execution APIs now parse the exact BCS transaction bytes with the Sui `Transaction` parser before simulation/submission. The policy:

- requires the transaction sender to equal the connected/declared sender;
- rejects empty PTBs;
- bounds command and input counts;
- rejects `Publish` and `Upgrade` commands because JARVIS Swap/Send never require package administration;
- rejects a different gas owner because sponsored execution is not supported by this boundary;
- still requires strict Base64 decoding, wallet signature verification, fresh simulation, idempotent submission, and Sui finality.

This is defense in depth. It does not replace Sui signature verification or transaction simulation.

## Settings workspace

`/settings` provides a responsive user-facing workspace for appearance, portfolio currency, small-balance filtering, verified-token filtering, and live Sui network status. Security-critical execution controls remain deployment-owned and cannot be disabled from local preferences.
