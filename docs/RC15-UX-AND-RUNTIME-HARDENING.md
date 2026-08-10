# JARVIS Swap rc.15 — UX and runtime hardening

This pass keeps the release version at `1.0.0-rc.15` and strengthens the production UI/runtime contract.

## Dialog accessibility

All primary modal surfaces use the shared `useDialogA11y` hook. It traps keyboard focus, restores the previous focus target, closes on Escape when the action is safe to cancel, and uses a reference-counted body scroll lock so nested overlays do not accidentally re-enable page scrolling.

The transaction review dialog intentionally cannot be dismissed while a signature is being requested or while an already-submitted transaction is awaiting chain confirmation. This reduces duplicate-submit risk.

## Quote race protection

Quote requests use a monotonic request identifier in addition to `AbortController`. A slower response from an older input/settings state cannot overwrite a newer quote even if it resolves close to cancellation.

## Deployment policy limits

Client preferences remain subordinate to server deployment policy. Slippage and maximum price-impact values loaded from local storage are clamped again after the deployment configuration is resolved. The settings UI also reflects deployment maxima and disables presets that exceed policy.

## Wallet service UX

Send amount input accepts only a single valid decimal form and uses the shared exact positive-decimal validator for action eligibility. The send dialog cannot be dismissed while signing/submission is in progress. Clipboard failures are handled instead of becoming unhandled promise rejections.

## Transaction progress

Review surfaces expose a restrained four-stage progress indicator: Review → Sign → Submit → Confirm. It communicates state without treating a returned transaction digest as finality.
