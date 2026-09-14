-- Follow-up fix migration. Safe to run even if 202609130007 was already
-- applied, and safe to run if it was never applied — every statement below
-- is idempotent (create/add/drop ... if [not] exists).

-- ── Email + Calendar notification columns ──────────────────────────────
-- Re-asserted here in case 202609130007 was not actually run yet — this is
-- the direct cause of "Could not find the 'email_notifications_enabled'
-- column ... in the schema cache".
alter table public.business_notification_settings add column if not exists notification_email text;
alter table public.business_notification_settings add column if not exists email_notifications_enabled boolean not null default false;
alter table public.business_notification_settings add column if not exists calendar_integration_enabled boolean not null default false;

-- ── Client Activity access: rename to the exact column names the app uses ─
create table if not exists public.business_client_access (
  business_id uuid primary key references public.businesses(id) on delete cascade,
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

-- Add the exact columns the app reads/writes first. Existing installs may
-- already have values in the original 007 columns, so preserve those values
-- before removing the legacy names.
alter table public.business_client_access add column if not exists client_activity_enabled boolean not null default false;
alter table public.business_client_access add column if not exists client_activity_show_orders boolean not null default true;
alter table public.business_client_access add column if not exists client_activity_show_bookings boolean not null default true;
alter table public.business_client_access add column if not exists client_activity_show_service_requests boolean not null default true;
alter table public.business_client_access add column if not exists activity_access_token text unique default encode(gen_random_bytes(24), 'hex');

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'business_client_access' and column_name = 'enabled') then
    execute 'update public.business_client_access set client_activity_enabled = enabled';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'business_client_access' and column_name = 'show_orders') then
    execute 'update public.business_client_access set client_activity_show_orders = show_orders';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'business_client_access' and column_name = 'show_bookings') then
    execute 'update public.business_client_access set client_activity_show_bookings = show_bookings';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'business_client_access' and column_name = 'show_service_requests') then
    execute 'update public.business_client_access set client_activity_show_service_requests = show_service_requests';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'business_client_access' and column_name = 'token') then
    execute 'update public.business_client_access set activity_access_token = token where token is not null';
  end if;
end $$;

alter table public.business_client_access drop column if exists enabled;
alter table public.business_client_access drop column if exists show_orders;
alter table public.business_client_access drop column if exists show_bookings;
alter table public.business_client_access drop column if exists show_service_requests;
alter table public.business_client_access drop column if exists token;

-- Force PostgREST to pick up the schema changes immediately instead of
-- waiting for its next automatic reload.
notify pgrst, 'reload schema';
