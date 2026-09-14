-- Customer self-service booking links and business-controlled push delivery.
-- Only a SHA-256 digest is stored; the raw token is returned once to the
-- customer by the booking API and is never readable from the database.

alter table public.appointments
  add column if not exists manage_token_hash text;

create unique index if not exists appointments_manage_token_hash_idx
  on public.appointments(manage_token_hash)
  where manage_token_hash is not null;

alter table public.business_notification_settings
  add column if not exists push_notifications_enabled boolean not null default true;
