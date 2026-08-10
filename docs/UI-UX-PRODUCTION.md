# JARVIS Swap — production UI/UX hardening

Version remains `1.0.0-rc.15`.

## Design principles

- The swap is the primary action; analytics and auxiliary data never compete with execution.
- Light theme is the default. The dark theme uses a restrained dark-blue system, not neon styling.
- The supplied JARVIS helmet asset remains the brand and token mark; it is not redrawn.
- No fabricated wallet balances, market metrics, network fees, or analytics are presented as live data.
- Touch targets remain at least 44px where practical and mobile content avoids horizontal scrolling.
- Mobile navigation uses a thumb-friendly bottom dock while the full workspace navigation remains available in the drawer.
- Modals become bottom sheets on mobile; swap review becomes full-screen where appropriate.
- Realtime events are refresh hints. Sui finality remains authoritative.

## Production UX changes

- Refined typography, spacing, borders, shadows, and semantic surface tokens.
- Rebuilt desktop header/sidebar hierarchy and mobile navigation dock.
- Added keyboard skip navigation and preserved visible focus states.
- Reworked Swap into a restrained execution workspace with clearer token inputs, quote state, fee/gas details, and safety rail.
- Removed static sample token/analytics numbers from the Swap rail.
- Analytics now fails honestly when the production indexer is not configured instead of presenting illustrative values as live telemetry.
- Portfolio and Tokens were rebuilt with responsive sections, loading states, virtualized lists, and clearer pricing provenance.
- Wallet connection and account surfaces were visually tightened while retaining Wallet Standard-only discovery.
- Exact token identity comparisons use coin type where available rather than symbol-only matching.
- Swap review preserves the exact user-entered decimal string rather than converting the authoritative amount through JavaScript `Number`.
- Custom-token network labeling follows the configured Sui network instead of being hard-coded to Mainnet.

## Responsive breakpoints

- `> 1020px`: desktop workspace with understated sidebar and optional right rail.
- `901–1020px`: single-column content while desktop shell remains available.
- `<= 900px`: compact header, drawer navigation, and bottom mobile dock.
- `<= 460px`: stacked token amount/selector controls and single-column review actions.

## Production validation

The existing security and execution invariants remain unchanged: signed quote integrity, maximum 250 bps service fee, simulation, signature verification, idempotent submission, and Sui finality verification are preserved.
