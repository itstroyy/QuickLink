-- Quicklink modular commerce, delivery and quote requests.
-- Run after 202609130001_customer_hub_phase1.sql.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120), description text,
  price_cents integer not null check (price_cents >= 0), image_url text, category text,
  available boolean not null default true, display_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null, customer_phone text not null,
  fulfillment_method text not null check (fulfillment_method in ('pickup','delivery')),
  address text, notes text, total_cents integer not null check (total_cents >= 0),
  status text not null default 'new' check (status in ('new','confirmed','preparing','ready','completed','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (fulfillment_method = 'pickup' or nullif(trim(address),'') is not null)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0), quantity integer not null check (quantity between 1 and 99)
);

create table if not exists public.delivery_requests (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null, customer_phone text not null, address text not null, items text not null, notes text,
  status text not null default 'new' check (status in ('new','confirmed','preparing','ready','completed','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null, customer_phone text not null, customer_email text, service_needed text not null,
  description text not null, preferred_date date, address text, notes text,
  status text not null default 'new' check (status in ('new','contacted','quoted','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.business_notification_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  notification_phone text, order_sms boolean not null default false, booking_sms boolean not null default false,
  quote_sms boolean not null default false, delivery_sms boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists products_business_order_idx on public.products(business_id, display_order);
create index if not exists orders_business_created_idx on public.orders(business_id, created_at desc);
create index if not exists delivery_business_created_idx on public.delivery_requests(business_id, created_at desc);
create index if not exists quotes_business_created_idx on public.quote_requests(business_id, created_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['products','orders','delivery_requests','quote_requests','business_notification_settings'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.delivery_requests enable row level security;
alter table public.quote_requests enable row level security;
alter table public.business_notification_settings enable row level security;

create or replace function public.quicklink_feature_enabled(target_business uuid, target_feature text)
returns boolean language sql security definer set search_path = public stable
as $$ select exists(select 1 from public.business_features f join public.businesses b on b.id=f.business_id where f.business_id=target_business and f.feature_key=target_feature and f.enabled and b.status='active') $$;

create or replace function public.submit_quicklink_order(p_business_id uuid, p_customer_name text, p_customer_phone text, p_method text, p_address text, p_notes text, p_items jsonb)
returns table(order_id uuid, total_cents integer) language plpgsql security definer set search_path = public as $$
declare new_id uuid; calculated_total integer;
begin
  if not public.quicklink_feature_enabled(p_business_id, 'ordering') then raise exception 'Ordering is not available'; end if;
  if nullif(trim(p_customer_name),'') is null or nullif(trim(p_customer_phone),'') is null then raise exception 'Name and phone are required'; end if;
  if p_method not in ('pickup','delivery') or (p_method='delivery' and nullif(trim(p_address),'') is null) then raise exception 'Invalid fulfillment details'; end if;
  select sum(p.price_cents * requested.quantity)::integer into calculated_total
  from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
  join public.products p on p.id=requested.product_id and p.business_id=p_business_id and p.available
  where requested.quantity between 1 and 99;
  if calculated_total is null or calculated_total < 0 then raise exception 'Add at least one available product'; end if;
  insert into public.orders(business_id,customer_name,customer_phone,fulfillment_method,address,notes,total_cents)
  values(p_business_id,left(trim(p_customer_name),120),left(trim(p_customer_phone),40),p_method,nullif(left(trim(p_address),500),''),nullif(left(trim(p_notes),1500),''),calculated_total) returning id into new_id;
  insert into public.order_items(order_id,product_id,product_name,unit_price_cents,quantity)
  select new_id,p.id,p.name,p.price_cents,requested.quantity from jsonb_to_recordset(p_items) as requested(product_id uuid, quantity integer)
  join public.products p on p.id=requested.product_id and p.business_id=p_business_id and p.available where requested.quantity between 1 and 99;
  return query select new_id, calculated_total;
end $$;

create or replace function public.submit_delivery_request(p_business_id uuid,p_name text,p_phone text,p_address text,p_items text,p_notes text)
returns uuid language plpgsql security definer set search_path=public as $$ declare new_id uuid; begin
  if not public.quicklink_feature_enabled(p_business_id,'delivery') then raise exception 'Delivery requests are not available'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_phone),'') is null or nullif(trim(p_address),'') is null or nullif(trim(p_items),'') is null then raise exception 'Required details are missing'; end if;
  insert into public.delivery_requests(business_id,customer_name,customer_phone,address,items,notes) values(p_business_id,left(trim(p_name),120),left(trim(p_phone),40),left(trim(p_address),500),left(trim(p_items),2000),nullif(left(trim(p_notes),1500),'')) returning id into new_id; return new_id;
end $$;

create or replace function public.submit_quote_request(p_business_id uuid,p_name text,p_phone text,p_email text,p_service text,p_description text,p_preferred_date date,p_address text,p_notes text)
returns uuid language plpgsql security definer set search_path=public as $$ declare new_id uuid; begin
  if not public.quicklink_feature_enabled(p_business_id,'quote_request') then raise exception 'Quote requests are not available'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_phone),'') is null or nullif(trim(p_service),'') is null or nullif(trim(p_description),'') is null then raise exception 'Required details are missing'; end if;
  insert into public.quote_requests(business_id,customer_name,customer_phone,customer_email,service_needed,description,preferred_date,address,notes) values(p_business_id,left(trim(p_name),120),left(trim(p_phone),40),nullif(left(trim(p_email),160),''),left(trim(p_service),160),left(trim(p_description),2500),p_preferred_date,nullif(left(trim(p_address),500),''),nullif(left(trim(p_notes),1500),'')) returning id into new_id; return new_id;
end $$;

revoke all on function public.quicklink_feature_enabled(uuid,text), public.submit_quicklink_order(uuid,text,text,text,text,text,jsonb), public.submit_delivery_request(uuid,text,text,text,text,text), public.submit_quote_request(uuid,text,text,text,text,text,date,text,text) from public;
grant execute on function public.quicklink_feature_enabled(uuid,text), public.submit_quicklink_order(uuid,text,text,text,text,text,jsonb), public.submit_delivery_request(uuid,text,text,text,text,text), public.submit_quote_request(uuid,text,text,text,text,text,date,text,text) to anon, authenticated;

drop policy if exists "Public reads available products" on public.products;
create policy "Public reads available products" on public.products for select using (public.is_quicklink_admin() or (available and public.quicklink_feature_enabled(business_id,'ordering')));

do $$ declare table_name text; begin
  foreach table_name in array array['products','orders','order_items','delivery_requests','quote_requests','business_notification_settings'] loop
    execute format('drop policy if exists "Admins read %s" on public.%I',table_name,table_name);
    execute format('create policy "Admins read %s" on public.%I for select to authenticated using (public.is_quicklink_admin())',table_name,table_name);
    execute format('drop policy if exists "Admins insert %s" on public.%I',table_name,table_name);
    execute format('create policy "Admins insert %s" on public.%I for insert to authenticated with check (public.is_quicklink_admin())',table_name,table_name);
    execute format('drop policy if exists "Admins update %s" on public.%I',table_name,table_name);
    execute format('create policy "Admins update %s" on public.%I for update to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin())',table_name,table_name);
    execute format('drop policy if exists "Admins delete %s" on public.%I',table_name,table_name);
    execute format('create policy "Admins delete %s" on public.%I for delete to authenticated using (public.is_quicklink_admin())',table_name,table_name);
  end loop;
end $$;

grant select on public.products to anon, authenticated;
grant all on public.products,public.orders,public.order_items,public.delivery_requests,public.quote_requests,public.business_notification_settings to authenticated;

insert into public.business_features(business_id,feature_key,enabled,display_order)
select b.id,f.key,false,f.ord from public.businesses b cross join (values('ordering',0),('delivery',1),('quote_request',2)) f(key,ord)
on conflict(business_id,feature_key) do nothing;
insert into public.business_notification_settings(business_id) select id from public.businesses on conflict(business_id) do nothing;
