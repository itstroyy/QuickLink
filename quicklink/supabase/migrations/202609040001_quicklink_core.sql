-- Run once in Supabase SQL Editor. Safe to run again.
create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  tagline text,
  description text,
  category text,
  phone text,
  sms text,
  email text,
  address text,
  logo_url text,
  cover_url text,
  theme text not null default 'minimal' check (theme in ('minimal','luxury','dark','beauty','automotive')),
  background_color text not null default '#f4f3ef',
  card_color text not null default '#ffffff',
  primary_color text not null default '#b48352',
  button_color text not null default '#ffffff',
  button_text_color text not null default '#1d1d1b',
  text_color text not null default '#1d1d1b',
  secondary_text_color text not null default '#77766e',
  border_radius text not null default 'soft' check (border_radius in ('soft','round','sharp')),
  background_gradient text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_links (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null,
  label text not null check (char_length(label) between 1 and 80),
  url text not null,
  icon text,
  display_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  link_id uuid references public.business_links(id) on delete set null,
  event_type text not null check (event_type in ('page_view','link_click')),
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  business_name text not null default 'Quicklink',
  main_domain text not null default 'quicklinkqr.com',
  default_theme text not null default 'minimal' check (default_theme in ('minimal','luxury','dark','beauty','automotive')),
  default_background_color text not null default '#f4f3ef',
  default_primary_color text not null default '#b48352',
  default_button_color text not null default '#ffffff',
  default_button_text_color text not null default '#1d1d1b',
  default_text_color text not null default '#1d1d1b',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create index if not exists businesses_status_idx on public.businesses(status);
create index if not exists business_links_business_order_idx on public.business_links(business_id, display_order);
create index if not exists analytics_business_created_idx on public.analytics_events(business_id, created_at desc);
create index if not exists analytics_link_idx on public.analytics_events(link_id) where link_id is not null;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_set_updated_at on public.businesses;
create trigger businesses_set_updated_at before update on public.businesses for each row execute function public.set_updated_at();
drop trigger if exists settings_set_updated_at on public.site_settings;
create trigger settings_set_updated_at before update on public.site_settings for each row execute function public.set_updated_at();

create or replace function public.is_quicklink_unavailable(requested_slug text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$ select exists(select 1 from public.businesses where slug = requested_slug and status <> 'active') $$;
grant execute on function public.is_quicklink_unavailable(text) to anon, authenticated;

alter table public.businesses enable row level security;
alter table public.business_links enable row level security;
alter table public.analytics_events enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "Public reads active businesses" on public.businesses;
create policy "Public reads active businesses" on public.businesses for select using (status = 'active' or auth.role() = 'authenticated');
drop policy if exists "Admins create businesses" on public.businesses;
create policy "Admins create businesses" on public.businesses for insert to authenticated with check (true);
drop policy if exists "Admins update businesses" on public.businesses;
create policy "Admins update businesses" on public.businesses for update to authenticated using (true) with check (true);
drop policy if exists "Admins delete businesses" on public.businesses;
create policy "Admins delete businesses" on public.businesses for delete to authenticated using (true);

drop policy if exists "Public reads active business links" on public.business_links;
create policy "Public reads active business links" on public.business_links for select using (
  auth.role() = 'authenticated' or exists (select 1 from public.businesses b where b.id = business_id and b.status = 'active')
);
drop policy if exists "Admins create links" on public.business_links;
create policy "Admins create links" on public.business_links for insert to authenticated with check (true);
drop policy if exists "Admins update links" on public.business_links;
create policy "Admins update links" on public.business_links for update to authenticated using (true) with check (true);
drop policy if exists "Admins delete links" on public.business_links;
create policy "Admins delete links" on public.business_links for delete to authenticated using (true);

drop policy if exists "Public records analytics" on public.analytics_events;
create policy "Public records analytics" on public.analytics_events for insert with check (
  exists (select 1 from public.businesses b where b.id = business_id and b.status = 'active')
  and (link_id is null or exists (select 1 from public.business_links l where l.id = link_id and l.business_id = business_id and l.enabled))
);
drop policy if exists "Admins read analytics" on public.analytics_events;
create policy "Admins read analytics" on public.analytics_events for select to authenticated using (true);

drop policy if exists "Admins read settings" on public.site_settings;
create policy "Admins read settings" on public.site_settings for select to authenticated using (true);
drop policy if exists "Admins update settings" on public.site_settings;
create policy "Admins update settings" on public.site_settings for update to authenticated using (true) with check (id = 1);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-assets', 'business-assets', true, 5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public reads business assets" on storage.objects;
create policy "Public reads business assets" on storage.objects for select using (bucket_id = 'business-assets');
drop policy if exists "Admins upload business assets" on storage.objects;
create policy "Admins upload business assets" on storage.objects for insert to authenticated with check (bucket_id = 'business-assets');
drop policy if exists "Admins update business assets" on storage.objects;
create policy "Admins update business assets" on storage.objects for update to authenticated using (bucket_id = 'business-assets');
drop policy if exists "Admins delete business assets" on storage.objects;
create policy "Admins delete business assets" on storage.objects for delete to authenticated using (bucket_id = 'business-assets');

-- Demo pages make the dynamic system immediately testable.
insert into public.businesses (name, slug, tagline, description, category, theme, background_color, card_color, primary_color, button_color, button_text_color, text_color, secondary_text_color, border_radius)
values
  ('Fresh Cuts', 'fresh-cuts', 'Classic cuts. Modern craft.', 'A neighborhood barbershop focused on sharp work and an easy experience.', 'Barbershop', 'minimal', '#eadfce', '#fffaf2', '#a87645', '#ffffff', '#251e18', '#251e18', '#75675b', 'soft'),
  ('Gloss Nail Bar', 'gloss-nail-bar', 'A little polish goes a long way.', 'Modern nail care in a relaxing, welcoming studio.', 'Nail salon', 'beauty', '#f4e2e5', '#fff8f8', '#a75e73', '#ffffff', '#3e2930', '#3e2930', '#876b75', 'round'),
  ('Joe''s Auto', 'joes-auto', 'Straight answers. Solid work.', 'Reliable maintenance and repair for the cars our neighbors depend on.', 'Auto repair', 'automotive', '#d9d8d3', '#f5f4ef', '#c34f35', '#202426', '#ffffff', '#1d2224', '#687073', 'sharp'),
  ('Pizza Palace', 'pizza-palace', 'Hot slices. Neighborhood favorite.', 'Classic pies, quick pickup, and a table waiting for you.', 'Restaurant', 'luxury', '#34251d', '#fff7e7', '#d39738', '#a93624', '#ffffff', '#fff7e7', '#d8c6b6', 'soft')
on conflict (slug) do nothing;

insert into public.business_links (business_id, type, label, url, icon, display_order)
select b.id, x.type, x.label, x.url, x.icon, x.display_order
from public.businesses b
cross join lateral (values
  ('google_review','Leave us a Google Review','https://www.google.com/','google_review',0),
  ('booking','Book an appointment','https://example.com/booking','booking',1),
  ('instagram','Instagram','https://www.instagram.com/','instagram',2),
  ('directions','Get directions','https://maps.google.com/','directions',3)
) as x(type,label,url,icon,display_order)
where b.slug in ('fresh-cuts','gloss-nail-bar','joes-auto','pizza-palace')
and not exists (select 1 from public.business_links existing where existing.business_id = b.id);
