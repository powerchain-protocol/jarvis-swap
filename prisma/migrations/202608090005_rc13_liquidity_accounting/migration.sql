CREATE TABLE IF NOT EXISTS "jarvis_swap_liquidity_pool_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "liquidity_pool_id" UUID NOT NULL REFERENCES "jarvis_swap_liquidity_pools"("id") ON DELETE CASCADE,
  "current_tick_index" INTEGER,
  "current_sqrt_price" NUMERIC(78,0),
  "liquidity" NUMERIC(78,0),
  "tvl_usd" NUMERIC(38,18),
  "volume_24h_usd" NUMERIC(38,18),
  "fees_24h_usd" NUMERIC(38,18),
  "observed_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "jarvis_swap_liquidity_pool_snapshots_pool_time_idx" ON "jarvis_swap_liquidity_pool_snapshots"("liquidity_pool_id", "observed_at" DESC);

CREATE TABLE IF NOT EXISTS "jarvis_swap_liquidity_position_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "liquidity_position_id" UUID NOT NULL REFERENCES "jarvis_swap_liquidity_positions"("id") ON DELETE CASCADE,
  "range_state" VARCHAR(20) NOT NULL,
  "current_tick_index" INTEGER,
  "liquidity" NUMERIC(78,0),
  "amount_a_base_units" NUMERIC(78,0),
  "amount_b_base_units" NUMERIC(78,0),
  "fee_owed_a_base_units" NUMERIC(78,0),
  "fee_owed_b_base_units" NUMERIC(78,0),
  "rewards" JSONB,
  "value_usd" NUMERIC(38,18),
  "observed_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "jarvis_swap_liquidity_position_snapshots_position_time_idx" ON "jarvis_swap_liquidity_position_snapshots"("liquidity_position_id", "observed_at" DESC);
