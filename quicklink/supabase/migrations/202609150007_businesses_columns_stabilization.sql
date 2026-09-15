-- Re-assert every column defined on public.businesses in
-- 202609040001_quicklink_core.sql. Additive and rerunnable.
--
-- Root cause this fixes: the dashboard "Business profile & appearance" form
-- (components/dashboard/business-profile-form.tsx) saves by sending the
-- whole edited business object to `supabase.from('businesses').update(...)`.
-- If ANY column on this table is missing in production — for example
-- because the table was created before 202609040001 was tracked as a
-- migration, or a deployment ran a partial/edited copy of it — that update
-- fails with Postgres 42703 ("column does not exist") or PostgREST PGRST204
-- ("column ... not found in the schema cache"), which
-- lib/client-errors.ts:26 turns into "Quicklink's database update is not
-- installed yet." This reproduces regardless of which field the user
-- actually edits, so the field the user happened to touch (Public email)
-- is not necessarily the only — or even the real — missing column.
--
-- Every statement below is `add column if not exists`, so it is a safe
-- no-op for any column that already exists and only creates the columns
-- that are actually missing. No existing business data is touched.
begin;

alter table public.businesses
  add column if not exists tagline text,
  add column if not exists description text,
  add column if not exists category text,
  add column if not exists phone text,
  add column if not exists sms text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists logo_url text,
  add column if not exists cover_url text,
  add column if not exists theme text not null default 'minimal',
  add column if not exists background_color text not null default '#f4f3ef',
  add column if not exists card_color text not null default '#ffffff',
  add column if not exists primary_color text not null default '#b48352',
  add column if not exists button_color text not null default '#ffffff',
  add column if not exists button_text_color text not null default '#1d1d1b',
  add column if not exists text_color text not null default '#1d1d1b',
  add column if not exists secondary_text_color text not null default '#77766e',
  add column if not exists border_radius text not null default 'soft',
  add column if not exists background_gradient text,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Restore the original value-list constraints only where missing. A column
-- added above with no prior constraint, or an old column that predates
-- these checks, both converge on the same rules the app already assumes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'businesses_theme_check') then
    alter table public.businesses add constraint businesses_theme_check check (theme in ('minimal','luxury','dark','beauty','automotive'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'businesses_border_radius_check') then
    alter table public.businesses add constraint businesses_border_radius_check check (border_radius in ('soft','round','sharp'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'businesses_status_check') then
    alter table public.businesses add constraint businesses_status_check check (status in ('active','inactive','archived'));
  end if;
end $$;

create index if not exists businesses_status_idx on public.businesses(status);

-- Force PostgREST to pick up the schema changes immediately instead of
-- waiting for its next automatic reload.
notify pgrst, 'reload schema';

commit;
