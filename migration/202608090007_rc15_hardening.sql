-- rc.15 hardening: enforce monetary and operational invariants at the database layer.
-- Application validation remains primary; these constraints protect against buggy
-- workers, manual SQL, or future code paths bypassing TypeScript validators.

ALTER TABLE "jarvis_swap_quotes"
  ADD CONSTRAINT "jarvis_swap_quotes_service_fee_bps_range" CHECK ("service_fee_bps" BETWEEN 0 AND 250),
  ADD CONSTRAINT "jarvis_swap_quotes_slippage_bps_range" CHECK ("slippage_bps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "jarvis_swap_quotes_price_impact_bps_range" CHECK ("max_price_impact_bps" BETWEEN 0 AND 10000),
  ADD CONSTRAINT "jarvis_swap_quotes_amounts_nonnegative" CHECK (
    "gross_amount_in_base_units" >= 0 AND
    "net_swap_amount_base_units" >= 0 AND
    "minimum_amount_out_base_units" >= 0 AND
    "service_fee_base_units" >= 0
  );

ALTER TABLE "jarvis_swap_transactions"
  ADD CONSTRAINT "jarvis_swap_transactions_service_fee_bps_range" CHECK ("service_fee_bps" BETWEEN 0 AND 250),
  ADD CONSTRAINT "jarvis_swap_transactions_amounts_nonnegative" CHECK (
    "gross_amount_in_base_units" >= 0 AND
    "minimum_out_base_units" >= 0 AND
    "service_fee_base_units" >= 0 AND
    ("amount_out_base_units" IS NULL OR "amount_out_base_units" >= 0) AND
    ("gas_used_mist" IS NULL OR "gas_used_mist" >= 0)
  );

ALTER TABLE "jarvis_swap_service_fees"
  ADD CONSTRAINT "jarvis_swap_service_fees_bps_range" CHECK ("fee_bps" BETWEEN 0 AND 250),
  ADD CONSTRAINT "jarvis_swap_service_fees_amount_nonnegative" CHECK ("amount_base_units" >= 0);

ALTER TABLE "jarvis_swap_api_rate_limits"
  ADD CONSTRAINT "jarvis_swap_api_rate_limits_count_positive" CHECK ("count" >= 0);

ALTER TABLE "jarvis_swap_api_idempotency"
  ADD CONSTRAINT "jarvis_swap_api_idempotency_status_code_range" CHECK ("status_code" BETWEEN 100 AND 599);
