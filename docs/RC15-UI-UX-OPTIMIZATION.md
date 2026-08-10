# JARVIS Swap rc.15 — UI/UX optimization pass

The application version remains `1.0.0-rc.15`.

## Improvements

- Compact icon-first desktop rail between 901px and 1180px to preserve trading workspace width.
- Centered top navigation remains intact; lower-priority items collapse before the primary Swap/Pool/Tokens flows.
- Mobile quote details use progressive disclosure so the amount, token selector and primary action remain above secondary execution metrics.
- Exact JARVIS helmet artwork is still used without redrawing or approximating it.
- Empty swap amount by default avoids immediately implying an intended trade or triggering unnecessary quote work.
- Token selector and MAX controls include explicit accessible labels.
- Better iOS/PWA safe-area behavior through `viewport-fit=cover` and light/dark browser theme colors.
- Brand presentation moved out of inline styles into a responsive CSS module.
- Reduced-transparency preference disables shell blur effects where supported.
- Narrow screens get more reliable toolbar, content and bottom-dock spacing without horizontal scrolling.

## UX hierarchy

1. Enter amount and select assets.
2. See live quote state and receive estimate.
3. Expand secondary trade details when needed on mobile.
4. Review the swap.
5. Sign in the connected Sui wallet.
6. Wait for verified Sui finality.

No transaction, fee, quote-integrity or Sui-finality protections were relaxed by this pass.
