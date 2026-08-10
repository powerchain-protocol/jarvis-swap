# RC15 Storage, Wallet, and Activity Hardening

Version remains `1.0.0-rc.15`.

## Fixed theme preference race

The previous theme provider could read a saved dark theme and, during the same initial effect cycle, write the default light theme back to storage before the restored state committed. The provider now waits until storage restoration has completed before persisting changes and uses the canonical `STORAGE_KEYS.theme` key.

## Safe browser storage

Shared string helpers now wrap localStorage reads, writes, and removals so Safari private-mode/storage-policy errors do not break wallet or theme UI. JSON storage continues to enforce bounded payload sizes.

## Wallet network correctness

Wallet connection now requires an account on the exact configured chain (`sui:mainnet`, `sui:testnet`, or `sui:devnet`). An account from a different Sui network is no longer displayed as connected and then rejected only at signing time.

Silent reconnect is attempted at most once per provider lifecycle and stale wallet names are removed safely.

## Wallet activity endpoint

The activity route now uses structured `AppError` handling, standard no-store responses, proper rate-limit response headers, bounded integer parsing for `limit`, and bounded/validated pagination cursors. It no longer guesses HTTP 429 status by searching error-message text.

## Accessibility baseline

Global focus-visible styling and min-width/overflow safeguards were added for keyboard navigation and narrow mobile layouts.
