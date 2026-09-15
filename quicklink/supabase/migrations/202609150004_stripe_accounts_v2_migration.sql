-- Track which Stripe Accounts API version created each connected account.
-- Stripe now rejects new connected-account creation through Accounts v1
-- (stripe.accounts.create) — new accounts must be created with
-- POST /v2/core/accounts instead. Accounts v2 is interoperable with most
-- v1 APIs, but its hosted-onboarding Account Link has its own v2 endpoint
-- (POST /v2/core/account_links) that understands v2 "configurations" the
-- v1 Account Link endpoint does not. So the app must know, per stored
-- account, which link flavor to use — and must NEVER touch an existing
-- v1 account's stored ID to "upgrade" it.
begin;

alter table public.business_payment_settings
  add column if not exists stripe_test_account_api text,
  add column if not exists stripe_live_account_api text;

alter table public.business_payment_settings drop constraint if exists business_payment_settings_stripe_test_account_api_check;
alter table public.business_payment_settings add constraint business_payment_settings_stripe_test_account_api_check
  check(stripe_test_account_api is null or stripe_test_account_api in ('v1','v2'));
alter table public.business_payment_settings drop constraint if exists business_payment_settings_stripe_live_account_api_check;
alter table public.business_payment_settings add constraint business_payment_settings_stripe_live_account_api_check
  check(stripe_live_account_api is null or stripe_live_account_api in ('v1','v2'));

-- No backfill needed: every account stored before this migration (test or
-- live, including MagicSudz's live account) was created via Accounts v1.
-- The application treats a null value here as 'v1', which is exactly
-- correct for all existing rows, so they keep using v1 Account Links
-- unchanged. Only accounts created from now on are stamped 'v2'.

commit;
