-- Quicklink customer hub, Phase 1. Run after 202609040001_quicklink_core.sql.
-- Safe to run more than once. Existing businesses, links and URLs are preserved.

create table if not exists public.quicklink_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- The platform previously allowed every authenticated user. Preserve all current
-- administrator accounts once, then require explicit allowlisting for new users.
insert into public.quicklink_admins (user_id)
select id from auth.users
where not exists (select 1 from public.quicklink_admins)
on conflict (user_id) do nothing;

create or replace function public.is_quicklink_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select exists(select 1 from public.quicklink_admins where user_id = auth.uid()) $$;
grant execute on function public.is_quicklink_admin() to anon, authenticated;

create table if not exists public.business_features (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  feature_key text not null check (feature_key in ('services','special_offers','business_hours','announcements','gallery','contact_form','booking','ordering','delivery','quote_request','pricing','google_reviews','loyalty','referrals','text_list','email_list','menu','reorder')),
  enabled boolean not null default false,
  is_primary boolean not null default false,
  display_order integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, feature_key)
);

create unique index if not exists business_features_one_primary_idx on public.business_features(business_id) where is_primary;
create index if not exists business_features_business_order_idx on public.business_features(business_id, display_order);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120), description text, category text,
  price_cents integer check (price_cents is null or price_cents >= 0), duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  image_url text, enabled boolean not null default true, display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120), description text, badge text, promo_code text, image_url text,
  starts_at timestamptz, ends_at timestamptz, enabled boolean not null default true, display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), open_time time, close_time time,
  closed boolean not null default false, unique (business_id, day_of_week),
  check (closed or (open_time is not null and close_time is not null))
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120), body text, starts_at timestamptz, ends_at timestamptz,
  enabled boolean not null default true, display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  image_url text not null, caption text, enabled boolean not null default true, display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_forms (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120), description text, cta_label text not null default 'Send request',
  fields jsonb not null default '["name","phone","email","message"]'::jsonb,
  enabled boolean not null default true, display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.lead_submissions (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  lead_form_id uuid not null references public.lead_forms(id) on delete cascade,
  name text, phone text, email text, message text,
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);

alter table public.analytics_events add column if not exists visitor_id text;
alter table public.analytics_events add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.analytics_events drop constraint if exists analytics_events_event_type_check;
alter table public.analytics_events add constraint analytics_events_event_type_check check (event_type in ('page_view','link_click','feature_view','feature_click','lead_submit','promotion_click','call_click','text_click','directions_click','social_click','review_click'));

create index if not exists services_business_order_idx on public.services(business_id, display_order);
create index if not exists promotions_business_order_idx on public.promotions(business_id, display_order);
create index if not exists announcements_business_order_idx on public.announcements(business_id, display_order);
create index if not exists gallery_business_order_idx on public.gallery_items(business_id, display_order);
create index if not exists leads_business_created_idx on public.lead_submissions(business_id, created_at desc);
create index if not exists analytics_visitor_idx on public.analytics_events(business_id, visitor_id) where visitor_id is not null;

do $$ declare table_name text; begin
  foreach table_name in array array['business_features','services','promotions','announcements','lead_forms'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.business_features enable row level security;
alter table public.services enable row level security;
alter table public.promotions enable row level security;
alter table public.business_hours enable row level security;
alter table public.announcements enable row level security;
alter table public.gallery_items enable row level security;
alter table public.lead_forms enable row level security;
alter table public.lead_submissions enable row level security;

do $$ declare table_name text; begin
  foreach table_name in array array['business_features','services','promotions','announcements','gallery_items','lead_forms'] loop
    execute format('drop policy if exists "Public reads enabled %s" on public.%I', table_name, table_name);
    execute format('create policy "Public reads enabled %s" on public.%I for select using (public.is_quicklink_admin() or (coalesce(enabled, true) and exists (select 1 from public.businesses b where b.id = business_id and b.status = ''active'')))', table_name, table_name);
    execute format('drop policy if exists "Admins insert %s" on public.%I', table_name, table_name);
    execute format('create policy "Admins insert %s" on public.%I for insert to authenticated with check (public.is_quicklink_admin())', table_name, table_name);
    execute format('drop policy if exists "Admins update %s" on public.%I', table_name, table_name);
    execute format('create policy "Admins update %s" on public.%I for update to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin())', table_name, table_name);
    execute format('drop policy if exists "Admins delete %s" on public.%I', table_name, table_name);
    execute format('create policy "Admins delete %s" on public.%I for delete to authenticated using (public.is_quicklink_admin())', table_name, table_name);
  end loop;
end $$;

-- business_hours has no enabled column, so replace its generated public policy.
drop policy if exists "Public reads enabled business_hours" on public.business_hours;
create policy "Public reads business hours" on public.business_hours for select using (
  public.is_quicklink_admin() or exists (select 1 from public.businesses b where b.id = business_id and b.status = 'active')
);
drop policy if exists "Admins insert business_hours" on public.business_hours;
create policy "Admins insert business_hours" on public.business_hours for insert to authenticated with check (public.is_quicklink_admin());
drop policy if exists "Admins update business_hours" on public.business_hours;
create policy "Admins update business_hours" on public.business_hours for update to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin());
drop policy if exists "Admins delete business_hours" on public.business_hours;
create policy "Admins delete business_hours" on public.business_hours for delete to authenticated using (public.is_quicklink_admin());

drop policy if exists "Public submits active lead forms" on public.lead_submissions;
create policy "Public submits active lead forms" on public.lead_submissions for insert with check (
  status = 'new' and exists (
    select 1 from public.lead_forms f join public.businesses b on b.id = f.business_id
    where f.id = lead_form_id and f.business_id = business_id and f.enabled and b.status = 'active'
  )
);
drop policy if exists "Admins read leads" on public.lead_submissions;
create policy "Admins read leads" on public.lead_submissions for select to authenticated using (public.is_quicklink_admin());
drop policy if exists "Admins update leads" on public.lead_submissions;
create policy "Admins update leads" on public.lead_submissions for update to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin());
drop policy if exists "Admins delete leads" on public.lead_submissions;
create policy "Admins delete leads" on public.lead_submissions for delete to authenticated using (public.is_quicklink_admin());

grant select on public.business_features, public.services, public.promotions, public.business_hours, public.announcements, public.gallery_items, public.lead_forms to anon, authenticated;
grant insert on public.lead_submissions to anon, authenticated;
grant all on public.business_features, public.services, public.promotions, public.business_hours, public.announcements, public.gallery_items, public.lead_forms, public.lead_submissions to authenticated;

alter table public.quicklink_admins enable row level security;
drop policy if exists "Admins read admin allowlist" on public.quicklink_admins;
create policy "Admins read admin allowlist" on public.quicklink_admins for select to authenticated using (public.is_quicklink_admin());
grant select on public.quicklink_admins to authenticated;

-- Tighten the original core policies from "any authenticated user" to the
-- Quicklink administrator allowlist while retaining public active-page access.
drop policy if exists "Public reads active businesses" on public.businesses;
create policy "Public reads active businesses" on public.businesses for select using (status = 'active' or public.is_quicklink_admin());
drop policy if exists "Admins create businesses" on public.businesses;
create policy "Admins create businesses" on public.businesses for insert to authenticated with check (public.is_quicklink_admin());
drop policy if exists "Admins update businesses" on public.businesses;
create policy "Admins update businesses" on public.businesses for update to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin());
drop policy if exists "Admins delete businesses" on public.businesses;
create policy "Admins delete businesses" on public.businesses for delete to authenticated using (public.is_quicklink_admin());

drop policy if exists "Public reads active business links" on public.business_links;
create policy "Public reads active business links" on public.business_links for select using (public.is_quicklink_admin() or exists (select 1 from public.businesses b where b.id = business_id and b.status = 'active'));
drop policy if exists "Admins create links" on public.business_links;
create policy "Admins create links" on public.business_links for insert to authenticated with check (public.is_quicklink_admin());
drop policy if exists "Admins update links" on public.business_links;
create policy "Admins update links" on public.business_links for update to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin());
drop policy if exists "Admins delete links" on public.business_links;
create policy "Admins delete links" on public.business_links for delete to authenticated using (public.is_quicklink_admin());

drop policy if exists "Admins read analytics" on public.analytics_events;
create policy "Admins read analytics" on public.analytics_events for select to authenticated using (public.is_quicklink_admin());
drop policy if exists "Admins read settings" on public.site_settings;
create policy "Admins read settings" on public.site_settings for select to authenticated using (public.is_quicklink_admin());
drop policy if exists "Admins update settings" on public.site_settings;
create policy "Admins update settings" on public.site_settings for update to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin() and id = 1);

drop policy if exists "Admins upload business assets" on storage.objects;
create policy "Admins upload business assets" on storage.objects for insert to authenticated with check (bucket_id = 'business-assets' and public.is_quicklink_admin());
drop policy if exists "Admins update business assets" on storage.objects;
create policy "Admins update business assets" on storage.objects for update to authenticated using (bucket_id = 'business-assets' and public.is_quicklink_admin());
drop policy if exists "Admins delete business assets" on storage.objects;
create policy "Admins delete business assets" on storage.objects for delete to authenticated using (bucket_id = 'business-assets' and public.is_quicklink_admin());

insert into public.business_features (business_id, feature_key, enabled, display_order)
select b.id, f.feature_key, false, f.display_order
from public.businesses b
cross join (values ('services',0),('special_offers',1),('business_hours',2),('announcements',3),('gallery',4),('contact_form',5)) as f(feature_key,display_order)
on conflict (business_id, feature_key) do nothing;
