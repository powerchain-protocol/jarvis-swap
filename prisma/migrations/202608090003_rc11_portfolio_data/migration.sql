-- rc.11 portfolio snapshots, durable rate limiting, and idempotency
CREATE TABLE IF NOT EXISTS public.jarvis_swap_portfolio_snapshots (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), wallet_address varchar(66) NOT NULL, network "Network" NOT NULL, total_value_usd numeric(38,18) NOT NULL, asset_count integer NOT NULL, priced_asset_count integer NOT NULL, observed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS jarvis_swap_portfolio_snapshots_wallet_time_idx ON public.jarvis_swap_portfolio_snapshots(wallet_address, observed_at DESC);
CREATE TABLE IF NOT EXISTS public.jarvis_swap_api_rate_limits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key varchar(196) NOT NULL, bucket_start timestamptz NOT NULL, count integer NOT NULL DEFAULT 1, expires_at timestamptz NOT NULL, UNIQUE(key,bucket_start));
CREATE INDEX IF NOT EXISTS jarvis_swap_api_rate_limits_expires_idx ON public.jarvis_swap_api_rate_limits(expires_at);
CREATE TABLE IF NOT EXISTS public.jarvis_swap_api_idempotency (key varchar(128) PRIMARY KEY, request_hash varchar(64) NOT NULL, status_code integer NOT NULL, response_body jsonb NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS jarvis_swap_api_idempotency_expires_idx ON public.jarvis_swap_api_idempotency(expires_at);
ALTER TABLE public.jarvis_swap_portfolio_snapshots ENABLE ROW LEVEL SECURITY; ALTER TABLE public.jarvis_swap_api_rate_limits ENABLE ROW LEVEL SECURITY; ALTER TABLE public.jarvis_swap_api_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.jarvis_swap_portfolio_snapshots, public.jarvis_swap_api_rate_limits, public.jarvis_swap_api_idempotency FROM anon, authenticated;
