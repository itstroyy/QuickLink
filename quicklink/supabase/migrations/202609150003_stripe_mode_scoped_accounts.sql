-- Stripe Connect account state must never mix test-mode and live-mode
-- accounts. Split the single stripe_account_id (and its derived capability
-- flags) into independent test/live column sets so a locally-tested
-- business can never reuse, or clear, the production business's live
-- connected account, and vice versa.
begin;

alter table public.business_payment_settings
  add column if not exists stripe_test_account_id text unique,
  add column if not exists stripe_test_details_submitted boolean not null default false,
  add column if not exists stripe_test_charges_enabled boolean not null default false,
  add column if not exists stripe_test_payouts_enabled boolean not null default false,
  add column if not exists stripe_test_account_status text not null default 'not_connected'
    check(stripe_test_account_status in ('not_connected','onboarding','restricted','enabled','disconnected')),
  add column if not exists stripe_test_connected_at timestamptz,
  add column if not exists stripe_live_account_id text unique,
  add column if not exists stripe_live_details_submitted boolean not null default false,
  add column if not exists stripe_live_charges_enabled boolean not null default false,
  add column if not exists stripe_live_payouts_enabled boolean not null default false,
  add column if not exists stripe_live_account_status text not null default 'not_connected'
    check(stripe_live_account_status in ('not_connected','onboarding','restricted','enabled','disconnected')),
  add column if not exists stripe_live_connected_at timestamptz;

-- One-time backfill: preserve every currently stored connected account as
-- the LIVE account. Before this change the app had no test/live
-- separation, and the bug this migration fixes (local test-mode reusing a
-- connected account created earlier) confirms any account already stored
-- here was created against a live secret key. This runs before the mirror
-- trigger below exists, so it reads the untouched legacy columns safely.
-- Nothing here is deleted.
update public.business_payment_settings
set stripe_live_account_id = stripe_account_id,
    stripe_live_details_submitted = stripe_details_submitted,
    stripe_live_charges_enabled = stripe_charges_enabled,
    stripe_live_payouts_enabled = stripe_payouts_enabled,
    stripe_live_account_status = stripe_account_status,
    stripe_live_connected_at = connected_at
where stripe_account_id is not null;

-- The legacy stripe_account_id / stripe_details_submitted /
-- stripe_charges_enabled / stripe_payouts_enabled / stripe_account_status /
-- connected_at columns stay in place unmodified: get_public_payment_config(),
-- submit_quicklink_order_productized() and submit_booking_productized() all
-- read them directly to decide whether a real customer can pay, and that
-- decision must always be based on the LIVE account, never on whichever
-- mode a developer's local app happens to be running. Rather than rewrite
-- those customer-facing checkout functions, this trigger keeps the legacy
-- columns mirroring stripe_live_* automatically on every write, so they
-- always mean "live" and stay correct without touching checkout logic.
create or replace function public.sync_legacy_stripe_columns() returns trigger
language plpgsql as $$
begin
  new.stripe_account_id := new.stripe_live_account_id;
  new.stripe_details_submitted := coalesce(new.stripe_live_details_submitted, false);
  new.stripe_charges_enabled := coalesce(new.stripe_live_charges_enabled, false);
  new.stripe_payouts_enabled := coalesce(new.stripe_live_payouts_enabled, false);
  new.stripe_account_status := coalesce(new.stripe_live_account_status, 'not_connected');
  new.connected_at := new.stripe_live_connected_at;
  return new;
end;
$$;

drop trigger if exists business_payment_settings_sync_legacy on public.business_payment_settings;
create trigger business_payment_settings_sync_legacy
  before insert or update on public.business_payment_settings
  for each row execute function public.sync_legacy_stripe_columns();

commit;
