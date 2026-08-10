# RC15 notifications and accessibility hardening

Version remains `1.0.0-rc.15`.

This pass adds a shared, accessible notification layer for copy, transfer, custom-token, and swap outcomes. Notifications are bounded, auto-dismiss, respect reduced motion/transparency preferences, and move above the mobile dock/safe area on small screens.

The provider does not replace transaction-state UI. Submitted/confirmed transaction state remains visible in the review and activity surfaces; toasts are supplemental feedback only.

Settings segmented controls now expose `aria-pressed`, copy failures are surfaced instead of silently ignored, and transaction errors are retained in their contextual dialogs while also receiving a concise global notification.
