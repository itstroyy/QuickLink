-- Stabilize owner CRUD after the membership/productization migrations.
-- Additive and rerunnable: no business data, slugs, users, or activity is removed.
begin;

-- Reassert the membership predicate used by every owner policy. Platform admins
-- remain globally authorized; regular members are scoped to a non-archived
-- business_members row for the requested business only.
create or replace function public.can_manage_business(target_business uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_quicklink_admin() or exists (
    select 1
    from public.business_members m
    join public.businesses b on b.id = m.business_id
    where m.business_id = target_business
      and m.user_id = auth.uid()
      and b.status <> 'archived'
  )
$$;
revoke all on function public.can_manage_business(uuid) from public;
grant execute on function public.can_manage_business(uuid) to anon, authenticated;

-- Reassert columns used by current CRUD payloads. These are intentionally
-- repeated with IF NOT EXISTS so a deployment that missed an earlier additive
-- migration converges on the schema expected by the application.
alter table public.products
  add column if not exists featured boolean not null default false,
  add column if not exists archived boolean not null default false;

alter table public.services
  add column if not exists bookable boolean not null default true,
  add column if not exists starting_at boolean not null default false,
  add column if not exists deposit_cents integer,
  add column if not exists action_type text not null default 'bookable',
  add column if not exists payment_override text,
  add column if not exists deposit_type text,
  add column if not exists deposit_value integer;

alter table public.promotions
  add column if not exists action_type text not null default 'none',
  add column if not exists action_value text,
  add column if not exists cta_label text;

alter table public.business_notification_settings
  add column if not exists notification_email text,
  add column if not exists email_notifications_enabled boolean not null default false,
  add column if not exists calendar_integration_enabled boolean not null default false;

alter table public.business_preferences
  add column if not exists products_section_title text,
  add column if not exists show_public_hours boolean not null default true,
  add column if not exists show_open_status boolean not null default true;

insert into public.business_preferences(business_id)
select id from public.businesses on conflict (business_id) do nothing;
insert into public.business_notification_settings(business_id)
select id from public.businesses on conflict (business_id) do nothing;
insert into public.business_payment_settings(business_id)
select id from public.businesses on conflict (business_id) do nothing;

-- The membership migration created read/insert/update policies for most
-- configuration tables but omitted DELETE, and older/partially applied
-- deployments can be missing one or more of the other policies. Replace the
-- complete set deterministically. RLS remains enabled throughout.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_links',
    'business_features',
    'products',
    'services',
    'promotions',
    'business_hours',
    'announcements',
    'gallery_items',
    'lead_forms',
    'business_notification_settings',
    'business_client_access'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "Members read" on public.%I', table_name);
    execute format('drop policy if exists "Members insert" on public.%I', table_name);
    execute format('drop policy if exists "Members update" on public.%I', table_name);
    execute format('drop policy if exists "Members delete" on public.%I', table_name);
    execute format('create policy "Members read" on public.%I for select to authenticated using (public.can_manage_business(business_id))', table_name);
    execute format('create policy "Members insert" on public.%I for insert to authenticated with check (public.can_manage_business(business_id))', table_name);
    execute format('create policy "Members update" on public.%I for update to authenticated using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id))', table_name);
    execute format('create policy "Members delete" on public.%I for delete to authenticated using (public.can_manage_business(business_id))', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end
$$;

alter table public.business_preferences enable row level security;
drop policy if exists "Members manage preferences" on public.business_preferences;
create policy "Members manage preferences"
on public.business_preferences
for all
to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));
grant select, insert, update on public.business_preferences to authenticated;

-- Business identity remains update-only for owners. The existing immutable
-- column trigger prevents members from changing slug/status/platform fields.
drop policy if exists "Members read business" on public.businesses;
drop policy if exists "Members update business" on public.businesses;
create policy "Members read business" on public.businesses for select to authenticated
  using (public.can_manage_business(id));
create policy "Members update business" on public.businesses for update to authenticated
  using (public.can_manage_business(id))
  with check (public.can_manage_business(id));
grant select, update on public.businesses to authenticated;

-- Payment policy writes intentionally remain behind authenticated server
-- routes using the service client. Owners only receive tenant-scoped reads.
alter table public.business_payment_settings enable row level security;
drop policy if exists "Members read payment settings" on public.business_payment_settings;
create policy "Members read payment settings" on public.business_payment_settings
for select to authenticated using (public.can_manage_business(business_id));
grant select on public.business_payment_settings to authenticated;

-- Owner uploads use a UUID business folder. Admin storage policies remain in
-- place, while these policies give members CRUD only inside their own folder.
drop policy if exists "Members upload own business images" on storage.objects;
drop policy if exists "Members update own business images" on storage.objects;
drop policy if exists "Members delete own business images" on storage.objects;
create policy "Members upload own business images" on storage.objects
for insert to authenticated with check (
  bucket_id = 'business-assets'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_manage_business(((storage.foldername(name))[1])::uuid)
    else false
  end
  and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
);
create policy "Members update own business images" on storage.objects
for update to authenticated
using (
  bucket_id = 'business-assets'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_manage_business(((storage.foldername(name))[1])::uuid)
    else false
  end
)
with check (
  bucket_id = 'business-assets'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_manage_business(((storage.foldername(name))[1])::uuid)
    else false
  end
  and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
);
create policy "Members delete own business images" on storage.objects
for delete to authenticated using (
  bucket_id = 'business-assets'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then public.can_manage_business(((storage.foldername(name))[1])::uuid)
    else false
  end
);

notify pgrst, 'reload schema';
commit;
