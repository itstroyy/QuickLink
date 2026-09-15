-- Additive. "Page experience" owner-facing settings for the public client
-- page: motion (scroll reveal / UI transitions), whether the product
-- category filter chips render, and the product list layout. All three
-- ship with defaults that reproduce today's actual behavior, so existing
-- businesses see no visual change until an owner opens Settings and
-- changes one. Public-page code (components/client-modules.tsx,
-- components/commerce-modules.tsx) reads these; app/[slug]/page.tsx
-- already selects business_preferences with select('*'), so no server
-- code change was needed to pick these up.
begin;

alter table public.business_preferences add column if not exists motion_enabled boolean not null default true;
alter table public.business_preferences add column if not exists show_category_filters boolean not null default true;
alter table public.business_preferences add column if not exists product_layout text not null default 'auto';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'business_preferences_product_layout_check') then
    alter table public.business_preferences add constraint business_preferences_product_layout_check check (product_layout in ('list', 'cards', 'auto'));
  end if;
end $$;

commit;
