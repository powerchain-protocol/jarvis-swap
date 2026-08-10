begin;

create type public."Network" as enum ('mainnet', 'testnet');
create type public."SwapStatus" as enum ('quoted', 'signed', 'submitted', 'confirmed', 'failed', 'expired');
create type public."PriceProvider" as enum ('pyth', 'birdeye', 'coinmarketcap', 'coingecko');

create table public.jarvis_swap_wallets (
  id uuid primary key default gen_random_uuid(), address varchar(66) not null unique, network public."Network" not null,
  label varchar(80), first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index jarvis_swap_wallets_network_last_seen_idx on public.jarvis_swap_wallets(network, last_seen_at desc);

create table public.jarvis_swap_tokens (
  id uuid primary key default gen_random_uuid(), network public."Network" not null, coin_type text not null,
  symbol varchar(32) not null, name varchar(120) not null, decimals integer not null check (decimals between 0 and 18),
  logo_url text, verified boolean not null default false, metadata jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(network, coin_type)
);
create index jarvis_swap_tokens_network_symbol_idx on public.jarvis_swap_tokens(network, symbol);

create table public.jarvis_swap_token_prices (
  id uuid primary key default gen_random_uuid(), token_id uuid not null references public.jarvis_swap_tokens(id) on delete cascade,
  provider public."PriceProvider" not null, price_usd numeric(38,18) not null check (price_usd > 0), confidence_bps integer,
  observed_at timestamptz not null, created_at timestamptz not null default now()
);
create index jarvis_swap_token_prices_token_observed_idx on public.jarvis_swap_token_prices(token_id, observed_at desc);

create table public.jarvis_swap_quotes (
  id varchar(96) primary key, network public."Network" not null, wallet_address varchar(66), pay_coin_type text not null,
  receive_coin_type text not null, gross_amount_in_base_units numeric(78,0) not null check (gross_amount_in_base_units >= 0),
  net_swap_amount_base_units numeric(78,0) not null, minimum_amount_out_base_units numeric(78,0) not null,
  service_fee_base_units numeric(78,0) not null, service_fee_bps integer not null check (service_fee_bps between 0 and 250),
  service_fee_recipient varchar(66), slippage_bps integer not null check (slippage_bps between 1 and 1000),
  max_price_impact_bps integer not null, route jsonb, signature text, issued_at timestamptz not null, expires_at timestamptz not null,
  created_at timestamptz not null default now(), check (expires_at > issued_at)
);
create index jarvis_swap_quotes_wallet_created_idx on public.jarvis_swap_quotes(wallet_address, created_at desc);
create index jarvis_swap_quotes_network_expiry_idx on public.jarvis_swap_quotes(network, expires_at);

create table public.jarvis_swap_liquidity_pools (
  id uuid primary key default gen_random_uuid(), network public."Network" not null, pool_id varchar(128) not null,
  protocol varchar(32) not null default 'cetus', token_a_id uuid references public.jarvis_swap_tokens(id) on delete set null,
  token_b_id uuid references public.jarvis_swap_tokens(id) on delete set null, fee_rate_bps integer, tick_spacing integer,
  current_sqrt_price numeric(78,0), liquidity numeric(78,0), raw jsonb, last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(network, pool_id)
);

create table public.jarvis_swap_transactions (
  id uuid primary key default gen_random_uuid(), digest varchar(128) not null unique, quote_id varchar(96) unique references public.jarvis_swap_quotes(id) on delete set null,
  wallet_id uuid not null references public.jarvis_swap_wallets(id), pay_token_id uuid references public.jarvis_swap_tokens(id) on delete set null,
  receive_token_id uuid references public.jarvis_swap_tokens(id) on delete set null, network public."Network" not null,
  status public."SwapStatus" not null default 'submitted', gross_amount_in_base_units numeric(78,0) not null,
  amount_out_base_units numeric(78,0), minimum_out_base_units numeric(78,0) not null, service_fee_base_units numeric(78,0) not null,
  service_fee_bps integer not null check (service_fee_bps between 0 and 250), gas_used_mist numeric(78,0), checkpoint bigint,
  failure_reason text, submitted_at timestamptz not null default now(), confirmed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index jarvis_swap_transactions_wallet_submitted_idx on public.jarvis_swap_transactions(wallet_id, submitted_at desc);
create index jarvis_swap_transactions_status_idx on public.jarvis_swap_transactions(network, status, submitted_at desc);

create table public.jarvis_swap_service_fees (
  id uuid primary key default gen_random_uuid(), transaction_id uuid not null unique references public.jarvis_swap_transactions(id) on delete cascade,
  recipient varchar(66) not null, coin_type text not null, amount_base_units numeric(78,0) not null check (amount_base_units >= 0),
  fee_bps integer not null check (fee_bps between 0 and 250), created_at timestamptz not null default now()
);

create table public.jarvis_swap_liquidity_positions (
  id uuid primary key default gen_random_uuid(), network public."Network" not null, object_id varchar(128) not null,
  wallet_id uuid not null references public.jarvis_swap_wallets(id) on delete cascade,
  pool_id uuid references public.jarvis_swap_liquidity_pools(id) on delete set null, tick_lower integer, tick_upper integer,
  liquidity numeric(78,0), raw jsonb, last_synced_at timestamptz not null default now(), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(network, object_id)
);
create index jarvis_swap_positions_wallet_synced_idx on public.jarvis_swap_liquidity_positions(wallet_id, last_synced_at desc);

-- Backend-only by default. No anon/authenticated policies are created.
alter table public.jarvis_swap_wallets enable row level security;
alter table public.jarvis_swap_tokens enable row level security;
alter table public.jarvis_swap_token_prices enable row level security;
alter table public.jarvis_swap_quotes enable row level security;
alter table public.jarvis_swap_transactions enable row level security;
alter table public.jarvis_swap_service_fees enable row level security;
alter table public.jarvis_swap_liquidity_pools enable row level security;
alter table public.jarvis_swap_liquidity_positions enable row level security;

revoke all on public.jarvis_swap_wallets, public.jarvis_swap_tokens, public.jarvis_swap_token_prices,
  public.jarvis_swap_quotes, public.jarvis_swap_transactions, public.jarvis_swap_service_fees,
  public.jarvis_swap_liquidity_pools, public.jarvis_swap_liquidity_positions from anon, authenticated;

commit;
