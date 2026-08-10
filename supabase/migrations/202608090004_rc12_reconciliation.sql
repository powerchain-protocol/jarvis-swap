CREATE TABLE IF NOT EXISTS "jarvis_swap_chain_transactions" (
  "id" UUID PRIMARY KEY,
  "digest" VARCHAR(128) NOT NULL UNIQUE,
  "network" "Network" NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "sender" VARCHAR(66),
  "checkpoint" BIGINT,
  "gas_used_mist" NUMERIC(78,0),
  "balance_changes" JSONB,
  "events" JSONB,
  "observed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "jarvis_swap_chain_transactions_network_observed_idx" ON "jarvis_swap_chain_transactions" ("network", "observed_at" DESC);
CREATE INDEX IF NOT EXISTS "jarvis_swap_chain_transactions_sender_observed_idx" ON "jarvis_swap_chain_transactions" ("sender", "observed_at" DESC);
ALTER TABLE public.jarvis_swap_chain_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jarvis_swap_chain_transactions FROM anon, authenticated;
