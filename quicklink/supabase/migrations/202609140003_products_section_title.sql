-- Additive. Optional owner-set override for the public page's products/
-- showcase section heading; NULL falls back to the industry-based default
-- computed in code (lib/section-order.ts productsSectionTitleFor).
begin;
alter table public.business_preferences add column if not exists products_section_title text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'business_preferences_products_section_title_len') then
    alter table public.business_preferences add constraint business_preferences_products_section_title_len check (products_section_title is null or char_length(products_section_title) <= 60);
  end if;
end $$;
commit;
