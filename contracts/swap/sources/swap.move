module jarvis_swap::swap;

use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::{Self, TxContext};

const BPS_DENOMINATOR: u64 = 10_000;
const MAX_SERVICE_FEE_BPS: u64 = 250;
const E_FEE_TOO_HIGH: u64 = 1;
const E_PAUSED: u64 = 2;
const E_ZERO_RECIPIENT: u64 = 3;
const E_FEE_POLICY_CHANGED: u64 = 4;
const E_FEE_RECIPIENT_CHANGED: u64 = 5;
const E_ZERO_PAYMENT: u64 = 6;

public struct AdminCap has key, store {
    id: UID,
}

public struct Config has key {
    id: UID,
    fee_recipient: address,
    fee_bps: u64,
    paused: bool,
}

public struct FeeCollected<phantom T> has copy, drop {
    payer: address,
    recipient: address,
    gross_amount: u64,
    fee_amount: u64,
    fee_bps: u64,
}

public struct ConfigUpdated has copy, drop {
    fee_recipient: address,
    fee_bps: u64,
    paused: bool,
}

fun init(ctx: &mut TxContext) {
    let sender = tx_context::sender(ctx);
    let admin = AdminCap { id: object::new(ctx) };
    let config = Config {
        id: object::new(ctx),
        fee_recipient: sender,
        fee_bps: MAX_SERVICE_FEE_BPS,
        paused: false,
    };
    transfer::public_transfer(admin, sender);
    transfer::share_object(config);
}

public fun fee_bps(config: &Config): u64 { config.fee_bps }
public fun fee_recipient(config: &Config): address { config.fee_recipient }
public fun paused(config: &Config): bool { config.paused }
public fun max_service_fee_bps(): u64 { MAX_SERVICE_FEE_BPS }

public fun assert_policy(config: &Config, expected_fee_bps: u64, expected_fee_recipient: address) {
    assert!(!config.paused, E_PAUSED);
    assert!(expected_fee_bps <= MAX_SERVICE_FEE_BPS, E_FEE_TOO_HIGH);
    assert!(config.fee_bps == expected_fee_bps, E_FEE_POLICY_CHANGED);
    assert!(config.fee_recipient == expected_fee_recipient, E_FEE_RECIPIENT_CHANGED);
}

public fun calculate_fee(gross_amount: u64, fee_bps: u64): u64 {
    assert!(fee_bps <= MAX_SERVICE_FEE_BPS, E_FEE_TOO_HIGH);
    // Overflow-safe bps calculation for a u64 coin balance.
    (gross_amount / BPS_DENOMINATOR) * fee_bps
        + ((gross_amount % BPS_DENOMINATOR) * fee_bps) / BPS_DENOMINATOR
}

public fun collect_fee<T>(
    config: &Config,
    mut payment: Coin<T>,
    expected_fee_bps: u64,
    expected_fee_recipient: address,
    ctx: &mut TxContext,
): Coin<T> {
    // Bind the signed transaction to the exact fee policy the user reviewed.
    // If governance/admin changes the shared config before execution, the PTB aborts.
    assert_policy(config, expected_fee_bps, expected_fee_recipient);
    let gross_amount = coin::value(&payment);
    assert!(gross_amount > 0, E_ZERO_PAYMENT);
    let fee_amount = calculate_fee(gross_amount, config.fee_bps);
    if (fee_amount > 0) {
        let fee_coin = coin::split(&mut payment, fee_amount, ctx);
        transfer::public_transfer(fee_coin, config.fee_recipient);
    };
    event::emit(FeeCollected<T> {
        payer: tx_context::sender(ctx),
        recipient: config.fee_recipient,
        gross_amount,
        fee_amount,
        fee_bps: config.fee_bps,
    });
    payment
}

public entry fun update_config(
    _admin: &AdminCap,
    config: &mut Config,
    fee_recipient: address,
    fee_bps: u64,
    paused: bool,
) {
    assert!(fee_recipient != @0x0, E_ZERO_RECIPIENT);
    assert!(fee_bps <= MAX_SERVICE_FEE_BPS, E_FEE_TOO_HIGH);
    config.fee_recipient = fee_recipient;
    config.fee_bps = fee_bps;
    config.paused = paused;
    event::emit(ConfigUpdated { fee_recipient, fee_bps, paused });
}

#[test]
fun test_calculate_fee_exact_2_5_percent() {
    assert!(calculate_fee(100_000_000_000, 250) == 2_500_000_000, 100);
    assert!(calculate_fee(1, 250) == 0, 101);
    assert!(calculate_fee(10_000, 250) == 250, 102);
}


#[test]
fun test_policy_cap() {
    assert!(max_service_fee_bps() == 250, 103);
}
