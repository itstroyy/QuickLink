-- Turn 3: Email + Google Calendar notifications, archive/restore for
-- Orders/Bookings/Service Requests, Special Offer actions, redefined
-- activity statuses, and a secure private Client Activity access system.
-- Additive/idempotent where possible; the status-enum changes below are the
-- one breaking change, so existing rows are remapped before constraints
-- tighten.

-- ── 1. Notifications: email + calendar toggles ────────────────────────────
alter table public.business_notification_settings add column if not exists notification_email text;
alter table public.business_notification_settings add column if not exists email_notifications_enabled boolean not null default false;
alter table public.business_notification_settings add column if not exists calendar_integration_enabled boolean not null default false;

-- ── 2. Google Calendar connection (service-role only; never exposed to the
--       browser — tokens are only ever read/written via the admin client). ─
create table if not exists public.business_calendar_connections (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  provider text not null default 'google' check (provider in ('google')),
  calendar_id text not null default 'primary',
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists business_calendar_connections_set_updated_at on public.business_calendar_connections;
create trigger business_calendar_connections_set_updated_at before update on public.business_calendar_connections for each row execute function public.set_updated_at();
alter table public.business_calendar_connections enable row level security;
-- Intentionally no policies: only the service-role (admin) client can read
-- or write this table. Regular authenticated/anon requests get nothing.
revoke all on public.business_calendar_connections from anon, authenticated;

-- ── 4. Archive support for Orders / Bookings / Service Requests ───────────
alter table public.orders add column if not exists archived boolean not null default false;
alter table public.appointments add column if not exists archived boolean not null default false;
alter table public.service_requests add column if not exists archived boolean not null default false;

-- ── 5. Special Offer actions ───────────────────────────────────────────────
alter table public.promotions add column if not exists action_type text not null default 'none'
  check (action_type in ('none','order_now','booking','request_service','external_link','call','text'));
alter table public.promotions add column if not exists action_value text;
alter table public.promotions add column if not exists cta_label text;

-- ── 7. Private Client Activity access (secure token, admin-managed) ───────
create table if not exists public.business_client_access (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  enabled boolean not null default false,
  show_orders boolean not null default true,
  show_bookings boolean not null default true,
  show_service_requests boolean not null default true,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists business_client_access_set_updated_at on public.business_client_access;
create trigger business_client_access_set_updated_at before update on public.business_client_access for each row execute function public.set_updated_at();
alter table public.business_client_access enable row level security;
drop policy if exists "Admins read client access" on public.business_client_access;
create policy "Admins read client access" on public.business_client_access for select to authenticated using (public.is_quicklink_admin());
drop policy if exists "Admins write client access" on public.business_client_access;
create policy "Admins write client access" on public.business_client_access for all to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin());
grant all on public.business_client_access to authenticated;
-- No anon/public policies. The token itself is verified server-side only,
-- using the admin (service-role) client — see lib/client-access.ts. The
-- browser never queries this table directly with a token.

-- ── 8. Redefine activity statuses ──────────────────────────────────────────
-- Orders: new, preparing, ready, completed, cancelled (drop 'confirmed').
update public.orders set status = 'preparing' where status = 'confirmed';
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('new','preparing','ready','completed','cancelled'));

-- Bookings: confirmed, completed, cancelled (drop 'new', 'no_show').
update public.appointments set status = 'confirmed' where status = 'new';
update public.appointments set status = 'cancelled' where status = 'no_show';
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('confirmed','completed','cancelled'));
alter table public.appointments alter column status set default 'confirmed';

-- Service requests: new, contacted, in_progress, completed, cancelled.
update public.service_requests set status = 'in_progress' where status = 'scheduled';
update public.service_requests set status = 'cancelled' where status = 'closed';
alter table public.service_requests drop constraint if exists service_requests_status_check;
alter table public.service_requests add constraint service_requests_status_check
  check (status in ('new','contacted','in_progress','completed','cancelled'));
