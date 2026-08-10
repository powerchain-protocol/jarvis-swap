# JARVIS Swap rc.15 — wallet-session replay hardening

Version remains `1.0.0-rc.15`.

## Changes

- Production wallet cookies use the `__Host-` prefix, `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`.
- Wallet verification challenges are reserved before signature verification to prevent concurrent reuse.
- A successfully verified challenge is marked consumed for the remainder of its short TTL.
- Invalid signatures release the reservation so the user can retry before expiry.
- Database persistence, when enabled, makes challenge consumption cross-instance; the process-local fallback protects a single runtime instance.
- The browser refreshes wallet-session state when a session reaches its expiry, when the tab becomes visible, and when network connectivity returns.
- Transaction signing still requires the HTTP-only session when `JARVIS_REQUIRE_WALLET_SESSION=true`.

## Security properties

A challenge remains bound to the application origin, Sui network, normalized wallet address, random nonce, issue time, expiry, and browser challenge cookie. The signature is verified as a Sui personal-message signature and cannot be reused as a transaction signature.

Mainnet deployments should enable database persistence when strong cross-instance challenge-consumption guarantees are required.
