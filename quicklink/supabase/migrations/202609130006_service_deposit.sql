-- Adds an optional deposit amount to services, so the booking module's data
-- model is ready for deposits later. This migration only adds the column —
-- no payment processing is implemented. A service with deposit_cents set
-- shows "Deposit required: $X" to customers; nothing is charged yet.

alter table public.services add column if not exists deposit_cents integer;
alter table public.services drop constraint if exists services_deposit_cents_check;
alter table public.services add constraint services_deposit_cents_check check (deposit_cents is null or deposit_cents >= 0);
