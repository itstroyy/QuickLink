-- Additive owner-account migration. Run after 202609130014. No data resets or slug changes.
begin;
create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','manager')),
  created_at timestamptz not null default now(), primary key (business_id,user_id)
);
create index if not exists business_members_user_idx on public.business_members(user_id);
create table if not exists public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  role text not null default 'owner' check(role in ('owner','manager')),
  invited_by uuid references auth.users(id), created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days', accepted_at timestamptz,
  unique(business_id,email)
);
alter table public.business_members enable row level security;
alter table public.business_invitations enable row level security;
create or replace function public.can_manage_business(target_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_quicklink_admin() or exists (
    select 1 from public.business_members m join public.businesses b on b.id=m.business_id
    where m.business_id=target_business and m.user_id=auth.uid() and b.status <> 'archived'
  )
$$;
revoke all on function public.can_manage_business(uuid) from public;
grant execute on function public.can_manage_business(uuid) to authenticated, anon;
create policy "Members see their memberships" on public.business_members for select to authenticated using(user_id=auth.uid() or public.is_quicklink_admin());
create policy "Admins manage memberships" on public.business_members for all to authenticated using(public.is_quicklink_admin()) with check(public.is_quicklink_admin());
create policy "Admins manage invitations" on public.business_invitations for all to authenticated using(public.is_quicklink_admin()) with check(public.is_quicklink_admin());
grant select,insert,update,delete on public.business_members,public.business_invitations to authenticated;

-- Only verified Auth email can claim invitations. No client-supplied email or business ID.
create or replace function public.claim_business_invitations()
returns void language plpgsql security definer set search_path=public as $$
declare verified_email text; invitation record;
begin
  select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if verified_email is null then return; end if;
  for invitation in select * from public.business_invitations where email=verified_email and accepted_at is null and expires_at>now() for update loop
    insert into public.business_members(business_id,user_id,role) values(invitation.business_id,auth.uid(),invitation.role) on conflict do nothing;
    update public.business_invitations set accepted_at=now() where id=invitation.id;
  end loop;
end $$;
revoke all on function public.claim_business_invitations() from public;
grant execute on function public.claim_business_invitations() to authenticated;

create table if not exists public.business_preferences (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  industry text not null default 'general' check(industry in ('general','barber','beauty','detailing','repair','food','cleaning','retail')),
  primary_action text not null default 'auto' check(primary_action in ('auto','ordering','booking','request_service','phone','none')),
  section_order jsonb not null default '[]'::jsonb check(jsonb_typeof(section_order)='array'),
  timezone text not null default 'America/New_York',
  service_area text, fulfillment_text text, updated_at timestamptz not null default now()
);
alter table public.business_preferences enable row level security;
create policy "Public reads published preferences" on public.business_preferences for select using(public.can_manage_business(business_id) or exists(select 1 from public.businesses b where b.id=business_id and b.status='active'));
create policy "Members manage preferences" on public.business_preferences for all to authenticated using(public.can_manage_business(business_id)) with check(public.can_manage_business(business_id));
grant select on public.business_preferences to anon;
grant select,insert,update on public.business_preferences to authenticated;
insert into public.business_preferences(business_id) select id from public.businesses on conflict do nothing;
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists archived boolean not null default false;
alter table public.services add column if not exists starting_at boolean not null default false;
alter table public.orders add column if not exists internal_notes text;
alter table public.appointments add column if not exists internal_notes text;
alter table public.service_requests add column if not exists internal_notes text;
alter table public.service_requests add column if not exists updated_at timestamptz not null default now();
alter table public.business_push_subscriptions add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Widen accepted status values without rewriting any historical status.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check(status in ('new','confirmed','preparing','ready','completed','cancelled'));
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check(status in ('pending','confirmed','completed','cancelled','no_show'));
alter table public.service_requests drop constraint if exists service_requests_status_check;
alter table public.service_requests add constraint service_requests_status_check check(status in ('new','contacted','quoted','scheduled','in_progress','completed','cancelled'));

-- Add owner policies alongside the existing public-read/admin policies.
create policy "Members read business" on public.businesses for select to authenticated using(public.can_manage_business(id));
create policy "Members update business" on public.businesses for update to authenticated using(public.can_manage_business(id)) with check(public.can_manage_business(id));
do $$ declare t text; begin
  foreach t in array array['business_links','business_features','products','services','promotions','business_hours','announcements','gallery_items','lead_forms','business_notification_settings'] loop
    execute format('create policy "Members read" on public.%I for select to authenticated using(public.can_manage_business(business_id))',t);
    execute format('create policy "Members insert" on public.%I for insert to authenticated with check(public.can_manage_business(business_id))',t);
    execute format('create policy "Members update" on public.%I for update to authenticated using(public.can_manage_business(business_id)) with check(public.can_manage_business(business_id))',t);
  end loop;
  foreach t in array array['orders','appointments','service_requests','lead_submissions','delivery_requests','quote_requests','analytics_events'] loop
    execute format('create policy "Members read" on public.%I for select to authenticated using(public.can_manage_business(business_id))',t);
  end loop;
  foreach t in array array['orders','service_requests','lead_submissions'] loop
    execute format('create policy "Members update" on public.%I for update to authenticated using(public.can_manage_business(business_id)) with check(public.can_manage_business(business_id))',t);
  end loop;
end $$;
-- Appointment writes use the guarded API so Calendar cancellation is always handled.
create policy "Members read order items" on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and public.can_manage_business(o.business_id)));

-- RLS restricts rows; immutable-field triggers also restrict WHAT owners can edit.
create or replace function public.protect_owner_columns()
returns trigger language plpgsql set search_path=public as $$
begin
  if auth.uid() is not null and not public.is_quicklink_admin() then
    if tg_table_name='businesses' then
      if new.id<>old.id or new.slug<>old.slug or new.status<>old.status or new.created_at<>old.created_at then raise exception 'Platform fields cannot be edited by a business member'; end if;
    elsif tg_table_name in ('orders','service_requests','lead_submissions') then
      if (to_jsonb(new)-array['status','archived','internal_notes','updated_at']) is distinct from (to_jsonb(old)-array['status','archived','internal_notes','updated_at']) then raise exception 'Only activity status, archive and internal notes can be changed'; end if;
    elsif new.business_id<>old.business_id then raise exception 'Cannot move a record to another business';
    end if;
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['businesses','business_links','business_features','products','services','promotions','business_hours','announcements','gallery_items','lead_forms','business_notification_settings','business_preferences','orders','service_requests','lead_submissions'] loop
    execute format('create trigger protect_owner_columns before update on public.%I for each row execute function public.protect_owner_columns()',t);
  end loop;
end $$;
create trigger service_requests_set_updated_at before update on public.service_requests for each row execute function public.set_updated_at();
create trigger business_preferences_set_updated_at before update on public.business_preferences for each row execute function public.set_updated_at();

-- Existing published media remain publicly deliverable. Owners can create only under their business UUID.
-- Replacement uploads always use new UUID filenames; owners cannot overwrite/delete other objects.
create policy "Members upload own business images" on storage.objects for insert to authenticated with check(
  bucket_id='business-assets' and public.can_manage_business((storage.foldername(name))[1]::uuid)
  and lower(storage.extension(name)) in ('png','jpg','jpeg','webp')
);
-- OAuth tokens, push keys, legacy activity tokens and admin allowlist remain inaccessible to owners.
revoke all on public.business_calendar_connections,public.business_push_subscriptions from anon,authenticated;

create or replace function public.validate_business_preferences()
returns trigger language plpgsql set search_path=public as $$
begin
  if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid business timezone'; end if;
  if jsonb_array_length(new.section_order)>14 or exists(select 1 from jsonb_array_elements_text(new.section_order) x where x not in ('announcements','products','services','offers','booking','request','gallery','hours','reviews','contact','links','lead')) then raise exception 'Invalid page section'; end if;
  return new;
end $$;
create trigger validate_business_preferences before insert or update on public.business_preferences for each row execute function public.validate_business_preferences();
commit;
