# JARVIS Swap rc.9 — UI, responsive and client-runtime architecture

## Responsive behavior

`src/hooks/mobile.ts` centralizes mobile, compact-mobile and reduced-motion media queries. CSS remains the source of truth for layout; the hook is reserved for behavioral differences such as drawers and sheets.

- Mobile navigation uses a drawer and closes on route changes, Escape, or desktop breakpoint restoration.
- Touch targets are at least 44px, with primary transaction actions at 48–54px.
- Safe-area insets are respected on iOS devices.
- Tables continue to collapse to mobile cards and chart controls stack on small screens.
- Reduced-motion preferences disable nonessential animation and transitions.

## Performance

- Wallet connection UI is loaded dynamically only when needed.
- Analytics chart code is dynamically loaded with a skeleton fallback.
- `cache.ts` provides TTL caching plus request de-duplication for wallet and price reads.
- Price cache: 20 seconds. Wallet cache: 5 seconds. Transaction and quote endpoints remain non-cacheable where freshness is security-sensitive.
- `content-visibility` can be applied via `.lazy-section` to below-the-fold sections.

## Shared runtime modules

- `utils/formats.ts`: deterministic currency, token, integer, BPS and address formatting.
- `utils/rates.ts`: integer BPS arithmetic, 250-bps service-fee cap and minimum-received calculations.
- `utils/safe-actions.ts`: normalized action results, guarded JSON parsing and public error shaping.
- `types/*`: fee, wallet, chart, portfolio and token contracts shared by UI/data layers.
- `data/charts.ts`: isolated illustrative chart data until the analytics indexer is connected.
- `/actions.json`: machine-readable list of quote, validation, preflight and execution actions and their safety requirements.
