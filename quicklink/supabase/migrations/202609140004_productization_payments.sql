-- Final productization: Stripe Connect payments, refunds, booking holds,
-- multi-service bookings, quote lifecycle, and public-safe payment policies.
-- Additive only: existing businesses, slugs, activity and customer links survive.
begin;

alter table public.business_preferences
  add column if not exists show_public_hours boolean not null default true,
  add column if not exists show_open_status boolean not null default true;

alter table public.services
  add column if not exists action_type text not null default 'bookable',
  add column if not exists payment_override text,
  add column if not exists deposit_type text,
  add column if not exists deposit_value integer;
update public.services set action_type = case when bookable then 'bookable' else 'display_only' end
where action_type = 'bookable' and bookable = false;
alter table public.services drop constraint if exists services_action_type_check;
alter table public.services add constraint services_action_type_check check(action_type in ('bookable','request_quote','display_only'));
alter table public.services add constraint services_payment_override_check check(payment_override is null or payment_override in ('inherit','full','deposit','none'));
alter table public.services add constraint services_deposit_type_check check(deposit_type is null or deposit_type in ('percent','fixed'));
alter table public.services add constraint services_deposit_value_check check(deposit_value is null or deposit_value >= 0);

create table if not exists public.business_payment_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  stripe_account_id text unique,
  stripe_details_submitted boolean not null default false,
  stripe_charges_enabled boolean not null default false,
  stripe_payouts_enabled boolean not null default false,
  stripe_account_status text not null default 'not_connected' check(stripe_account_status in ('not_connected','onboarding','restricted','enabled','disconnected')),
  currency text not null default 'usd' check(currency ~ '^[a-z]{3}$'),
  order_payment_mode text not null default 'pay_later' check(order_payment_mode in ('online_required','pay_later')),
  booking_payment_mode text not null default 'none' check(booking_payment_mode in ('full','deposit','none')),
  deposit_type text not null default 'percent' check(deposit_type in ('percent','fixed')),
  deposit_value integer not null default 30 check(deposit_value >= 0),
  allow_multiple_services boolean not null default false,
  booking_refund_policy text not null default 'manual' check(booking_refund_policy in ('window','non_refundable','manual')),
  cancellation_window_hours integer not null default 24 check(cancellation_window_hours between 0 and 8760),
  deposit_refund_policy text not null default 'follow_window' check(deposit_refund_policy in ('refundable','non_refundable','follow_window')),
  order_cancellation_policy text not null default 'new_only' check(order_cancellation_policy in ('new_only','new_confirmed','never')),
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.business_payment_settings(business_id)
select id from public.businesses on conflict(business_id) do nothing;
create or replace function public.seed_business_payment_settings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_payment_settings(business_id)
  values(new.id)
  on conflict(business_id) do nothing;
  return new;
end;
$$;
create trigger businesses_seed_payment_settings
after insert on public.businesses
for each row execute function public.seed_business_payment_settings();
create trigger business_payment_settings_set_updated_at before update on public.business_payment_settings
for each row execute function public.set_updated_at();
alter table public.business_payment_settings enable row level security;
create policy "Members read payment settings" on public.business_payment_settings for select to authenticated
using(public.can_manage_business(business_id));
grant select on public.business_payment_settings to authenticated;

alter table public.orders
  add column if not exists customer_email text,
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists currency text not null default 'usd',
  add column if not exists payment_expires_at timestamptz,
  add column if not exists policy_snapshot jsonb not null default '{}'::jsonb;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check(status in ('pending_payment','new','confirmed','preparing','ready','completed','cancelled','payment_failed','expired'));
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check(payment_status in ('not_required','pending','paid','deposit_paid','refund_pending','partially_refunded','refunded','failed'));

alter table public.appointments
  add column if not exists total_price_cents integer not null default 0,
  add column if not exists amount_due_cents integer not null default 0,
  add column if not exists amount_paid_cents integer not null default 0,
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists currency text not null default 'usd',
  add column if not exists hold_expires_at timestamptz,
  add column if not exists duration_minutes integer,
  add column if not exists policy_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists integration_error text;
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check(status in ('pending_payment','pending','confirmed','completed','cancelled','no_show','payment_failed','expired'));
alter table public.appointments drop constraint if exists appointments_payment_status_check;
alter table public.appointments add constraint appointments_payment_status_check check(payment_status in ('not_required','pending','paid','deposit_paid','refund_pending','partially_refunded','refunded','failed'));

create table if not exists public.booking_services (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  price_cents integer not null default 0 check(price_cents >= 0),
  duration_minutes integer not null check(duration_minutes > 0),
  display_order integer not null default 0,
  primary key(appointment_id, display_order)
);
create index if not exists booking_services_service_idx on public.booking_services(service_id);
alter table public.booking_services enable row level security;
create policy "Members read booking services" on public.booking_services for select to authenticated using(
  exists(select 1 from public.appointments a where a.id=appointment_id and public.can_manage_business(a.business_id))
);
grant select on public.booking_services to authenticated;

alter table public.service_requests
  add column if not exists manage_token_hash text,
  add column if not exists quote_amount_cents integer,
  add column if not exists quote_message text,
  add column if not exists quote_notes text,
  add column if not exists quote_expires_at timestamptz,
  add column if not exists quote_sent_at timestamptz,
  add column if not exists quote_accepted_at timestamptz,
  add column if not exists payment_required boolean not null default false,
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists currency text not null default 'usd',
  add column if not exists policy_snapshot jsonb not null default '{}'::jsonb;
create unique index if not exists service_requests_manage_token_hash_idx on public.service_requests(manage_token_hash) where manage_token_hash is not null;
alter table public.service_requests drop constraint if exists service_requests_status_check;
alter table public.service_requests add constraint service_requests_status_check check(status in ('new','contacted','reviewing','quoted','accepted','paid','scheduled','in_progress','completed','cancelled','expired'));
alter table public.service_requests drop constraint if exists service_requests_payment_status_check;
alter table public.service_requests add constraint service_requests_payment_status_check check(payment_status in ('not_required','pending','paid','refund_pending','partially_refunded','refunded','failed'));

-- Allows a webhook to issue a second, hashed-only receipt link without
-- invalidating the token already held by the returning browser.
create table if not exists public.customer_access_tokens (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  resource_type text not null check(resource_type in ('order','booking','request')),
  resource_id uuid not null,
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists customer_access_resource_idx on public.customer_access_tokens(resource_type,resource_id);
alter table public.customer_access_tokens enable row level security;
revoke all on public.customer_access_tokens from anon,authenticated;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete restrict,
  service_request_id uuid references public.service_requests(id) on delete restrict,
  kind text not null check(kind in ('order','booking','quote')),
  stripe_account_id text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  status text not null default 'pending' check(status in ('pending','paid','deposit_paid','failed','expired','refund_pending','partially_refunded','refunded')),
  currency text not null check(currency ~ '^[a-z]{3}$'),
  amount_due_cents integer not null check(amount_due_cents >= 0),
  amount_paid_cents integer not null default 0 check(amount_paid_cents >= 0),
  amount_refunded_cents integer not null default 0 check(amount_refunded_cents >= 0),
  receipt_url text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(num_nonnulls(order_id,appointment_id,service_request_id)=1)
);
create index if not exists payments_business_created_idx on public.payments(business_id,created_at desc);
create index if not exists payments_intent_idx on public.payments(stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();
alter table public.payments enable row level security;
create policy "Members read payments" on public.payments for select to authenticated using(public.can_manage_business(business_id));
grant select on public.payments to authenticated;

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  stripe_refund_id text unique,
  amount_cents integer not null check(amount_cents > 0),
  reason text not null,
  status text not null default 'pending' check(status in ('pending','succeeded','failed','cancelled')),
  requested_by uuid references auth.users(id),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists refunds_business_created_idx on public.refunds(business_id,created_at desc);
create trigger refunds_set_updated_at before update on public.refunds for each row execute function public.set_updated_at();
alter table public.refunds enable row level security;
create policy "Members read refunds" on public.refunds for select to authenticated using(public.can_manage_business(business_id));
grant select on public.refunds to authenticated;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  stripe_account_id text,
  status text not null default 'processing' check(status in ('processing','processed','failed')),
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from anon, authenticated;

-- Public pages get capability/policy facts without ever seeing a connected account ID.
create or replace function public.get_public_payment_config(p_business_id uuid)
returns table(
  payments_ready boolean, currency text, order_payment_mode text,
  booking_payment_mode text, deposit_type text, deposit_value integer,
  allow_multiple_services boolean, booking_refund_policy text,
  cancellation_window_hours integer, deposit_refund_policy text,
  order_cancellation_policy text
) language sql security definer set search_path=public stable as $$
  select s.stripe_charges_enabled and s.stripe_payouts_enabled, s.currency,
    s.order_payment_mode, s.booking_payment_mode, s.deposit_type, s.deposit_value,
    s.allow_multiple_services, s.booking_refund_policy, s.cancellation_window_hours,
    s.deposit_refund_policy, s.order_cancellation_policy
  from public.business_payment_settings s join public.businesses b on b.id=s.business_id
  where s.business_id=p_business_id and b.status='active'
$$;
revoke all on function public.get_public_payment_config(uuid) from public;
grant execute on function public.get_public_payment_config(uuid) to anon,authenticated;

-- Server-authoritative pending order creation. Existing submit functions stay intact
-- for backward compatibility, but new UI/API traffic uses this lifecycle.
create or replace function public.submit_quicklink_order_productized(
  p_business_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text,
  p_method text, p_address text, p_notes text, p_items jsonb, p_manage_token_hash text
) returns table(order_id uuid,total_cents integer,payment_required boolean,currency text)
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_total integer; v_count integer; v_requested integer; v_settings public.business_payment_settings%rowtype; v_required boolean;
begin
  if not public.quicklink_feature_enabled(p_business_id,'ordering') then raise exception 'Ordering is not available'; end if;
  if nullif(trim(p_customer_name),'') is null or nullif(trim(p_customer_phone),'') is null then raise exception 'Name and phone are required'; end if;
  if p_method not in ('pickup','delivery') or (p_method='delivery' and nullif(trim(p_address),'') is null) then raise exception 'Invalid fulfillment details'; end if;
  if p_manage_token_hash is null or p_manage_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid order manage token'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50 then raise exception 'Choose between 1 and 50 products'; end if;
  select * into v_settings from public.business_payment_settings where business_id=p_business_id;
  v_required := coalesce(v_settings.order_payment_mode,'pay_later')='online_required';
  if v_required and (not coalesce(v_settings.stripe_charges_enabled,false) or not coalesce(v_settings.stripe_payouts_enabled,false)) then raise exception 'Online ordering is temporarily unavailable while payments are being configured'; end if;
  if v_required and nullif(trim(p_customer_email),'') is null then raise exception 'Email is required for a paid order receipt'; end if;
  select count(*),sum(p.price_cents*r.quantity)::integer into v_count,v_total
  from jsonb_to_recordset(p_items) r(product_id uuid,quantity integer)
  join public.products p on p.id=r.product_id and p.business_id=p_business_id and p.available and not coalesce(p.archived,false)
  where r.quantity between 1 and 99;
  v_requested := jsonb_array_length(p_items);
  if v_count<>v_requested or v_total is null or v_total<0 then raise exception 'One or more products are unavailable'; end if;
  insert into public.orders(business_id,customer_name,customer_phone,customer_email,fulfillment_method,address,notes,total_cents,status,payment_status,currency,payment_expires_at,manage_token_hash,policy_snapshot)
  values(p_business_id,left(trim(p_customer_name),120),left(trim(p_customer_phone),40),nullif(left(trim(p_customer_email),160),''),p_method,nullif(left(trim(p_address),500),''),nullif(left(trim(p_notes),1500),''),v_total,
    case when v_required then 'pending_payment' else 'new' end,case when v_required then 'pending' else 'not_required' end,coalesce(v_settings.currency,'usd'),
    case when v_required then now()+interval '30 minutes' else null end,p_manage_token_hash,
    jsonb_build_object('order_cancellation_policy',coalesce(v_settings.order_cancellation_policy,'new_only')))
  returning id into v_id;
  insert into public.order_items(order_id,product_id,product_name,unit_price_cents,quantity)
  select v_id,p.id,p.name,p.price_cents,r.quantity from jsonb_to_recordset(p_items) r(product_id uuid,quantity integer)
  join public.products p on p.id=r.product_id and p.business_id=p_business_id and p.available and not coalesce(p.archived,false)
  where r.quantity between 1 and 99;
  return query select v_id,v_total,v_required,coalesce(v_settings.currency,'usd');
end $$;
revoke all on function public.submit_quicklink_order_productized(uuid,text,text,text,text,text,text,jsonb,text) from public;
grant execute on function public.submit_quicklink_order_productized(uuid,text,text,text,text,text,text,jsonb,text) to anon,authenticated;

-- Active payment holds participate in availability; abandoned ones release automatically.
create or replace function public.quicklink_booked_ranges(p_business_id uuid,p_date date)
returns table(start_time time,end_time time) language sql security definer set search_path=public stable as $$
  select a.start_time,a.end_time from public.appointments a
  where a.business_id=p_business_id and a.appointment_date=p_date
    and (a.status in ('confirmed','pending') or (a.status='pending_payment' and a.hold_expires_at>now()))
$$;
revoke all on function public.quicklink_booked_ranges(uuid,date) from public;
grant execute on function public.quicklink_booked_ranges(uuid,date) to anon,authenticated;

create or replace function public.submit_booking_productized(
  p_business_id uuid,p_service_ids uuid[],p_date date,p_start_time time,
  p_name text,p_phone text,p_email text,p_notes text,p_manage_token_hash text
) returns table(appointment_id uuid,start_time time,end_time time,total_price_cents integer,amount_due_cents integer,payment_required boolean,currency text)
language plpgsql security definer set search_path=public as $$
declare v_settings public.business_payment_settings%rowtype; v_feature jsonb; v_count integer; v_duration integer; v_total integer; v_due integer; v_end time; v_id uuid; v_mode text; v_buffer integer; v_open time; v_close time; v_closed boolean;
begin
  if not public.quicklink_feature_enabled(p_business_id,'booking') then raise exception 'Booking is not available'; end if;
  if p_date<current_date or nullif(trim(p_name),'') is null or nullif(trim(p_phone),'') is null then raise exception 'Missing required booking details'; end if;
  if p_manage_token_hash is null or p_manage_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid booking manage token'; end if;
  if coalesce(cardinality(p_service_ids),0)<1 or cardinality(p_service_ids)>12 then raise exception 'Choose at least one service'; end if;
  select settings into v_feature from public.business_features where business_id=p_business_id and feature_key='booking' and enabled;
  select * into v_settings from public.business_payment_settings where business_id=p_business_id;
  if cardinality(p_service_ids)>1 and not coalesce(v_settings.allow_multiple_services,false) then raise exception 'This business accepts one service per booking'; end if;
  select count(*),sum(coalesce(duration_minutes,30))::integer,sum(coalesce(price_cents,0))::integer into v_count,v_duration,v_total
  from public.services where business_id=p_business_id and enabled and bookable and action_type='bookable' and id=any(p_service_ids);
  if v_count<>cardinality(p_service_ids) then raise exception 'One or more services are unavailable'; end if;
  v_mode:=coalesce(v_settings.booking_payment_mode,'none');
  if v_mode='full' then v_due:=v_total;
  elsif v_mode='deposit' then
    v_due:=case when v_settings.deposit_type='fixed' then least(v_total,v_settings.deposit_value) else least(v_total,ceil(v_total*v_settings.deposit_value/100.0)::integer) end;
  else v_due:=0; end if;
  if v_due>0 and (not coalesce(v_settings.stripe_charges_enabled,false) or not coalesce(v_settings.stripe_payouts_enabled,false)) then raise exception 'Online booking is temporarily unavailable while payments are being configured'; end if;
  if v_due>0 and nullif(trim(p_email),'') is null then raise exception 'Email is required for a paid booking receipt'; end if;
  v_end:=p_start_time+make_interval(mins=>v_duration);
  v_buffer:=coalesce((v_feature->>'buffer_minutes')::integer,0);
  select open_time,close_time,closed into v_open,v_close,v_closed from public.business_hours where business_id=p_business_id and day_of_week=extract(dow from p_date)::integer;
  if coalesce(v_closed,true) or v_open is null or v_close is null or p_start_time<v_open or v_end>v_close then raise exception 'That time is outside business hours'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text||p_date::text,0));
  if exists(select 1 from public.appointments a where a.business_id=p_business_id and a.appointment_date=p_date
    and (a.status in ('confirmed','pending') or (a.status='pending_payment' and a.hold_expires_at>now()))
    and p_start_time < a.end_time+make_interval(mins=>v_buffer) and v_end+make_interval(mins=>v_buffer)>a.start_time) then raise exception 'That time was just booked. Choose another time'; end if;
  insert into public.appointments(business_id,service_id,service_name,customer_name,customer_phone,customer_email,notes,appointment_date,start_time,end_time,status,manage_token_hash,total_price_cents,amount_due_cents,payment_status,currency,hold_expires_at,duration_minutes,policy_snapshot)
  select p_business_id,p_service_ids[1],string_agg(s.name,', ' order by x.ord),left(trim(p_name),120),left(trim(p_phone),40),nullif(left(trim(p_email),160),''),nullif(left(trim(p_notes),1500),''),p_date,p_start_time,v_end,
    case when v_due>0 then 'pending_payment' else 'confirmed' end,p_manage_token_hash,v_total,v_due,case when v_due>0 then 'pending' else 'not_required' end,coalesce(v_settings.currency,'usd'),case when v_due>0 then now()+interval '30 minutes' else null end,v_duration,
    jsonb_build_object('booking_refund_policy',coalesce(v_settings.booking_refund_policy,'manual'),'cancellation_window_hours',coalesce(v_settings.cancellation_window_hours,24),'deposit_refund_policy',coalesce(v_settings.deposit_refund_policy,'follow_window'),'payment_mode',v_mode)
  from unnest(p_service_ids) with ordinality x(id,ord) join public.services s on s.id=x.id returning id into v_id;
  insert into public.booking_services(appointment_id,service_id,service_name,price_cents,duration_minutes,display_order)
  select v_id,s.id,s.name,coalesce(s.price_cents,0),coalesce(s.duration_minutes,30),x.ord::integer from unnest(p_service_ids) with ordinality x(id,ord) join public.services s on s.id=x.id;
  return query select v_id,p_start_time,v_end,v_total,v_due,v_due>0,coalesce(v_settings.currency,'usd');
end $$;
revoke all on function public.submit_booking_productized(uuid,uuid[],date,time,text,text,text,text,text) from public;
grant execute on function public.submit_booking_productized(uuid,uuid[],date,time,text,text,text,text,text) to anon,authenticated;

create or replace function public.submit_service_request_managed(
  p_business_id uuid,p_name text,p_phone text,p_email text,p_address text,p_preferred_date date,p_request text,p_notes text,p_form_data jsonb,p_manage_token_hash text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if p_manage_token_hash is null or p_manage_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request manage token'; end if;
  v_id:=public.submit_service_request(p_business_id,p_name,p_phone,p_email,p_address,p_preferred_date,p_request,p_notes,p_form_data);
  update public.service_requests set manage_token_hash=p_manage_token_hash,status='new' where id=v_id;
  return v_id;
end $$;
revoke all on function public.submit_service_request_managed(uuid,text,text,text,text,date,text,text,jsonb,text) from public;
grant execute on function public.submit_service_request_managed(uuid,text,text,text,text,date,text,text,jsonb,text) to anon,authenticated;

create or replace function public.get_request_for_manage(p_manage_token_hash text)
returns table(id uuid,business_id uuid,customer_name text,customer_email text,preferred_date date,request_details text,status text,quote_amount_cents integer,quote_message text,quote_expires_at timestamptz,payment_required boolean,payment_status text,currency text,created_at timestamptz,business_name text,business_slug text)
language sql security definer set search_path=public stable as $$
  select r.id,r.business_id,r.customer_name,r.customer_email,r.preferred_date,r.request_details,r.status,r.quote_amount_cents,r.quote_message,r.quote_expires_at,r.payment_required,r.payment_status,r.currency,r.created_at,b.name,b.slug
  from public.service_requests r join public.businesses b on b.id=r.business_id where r.manage_token_hash=p_manage_token_hash
    or exists(select 1 from public.customer_access_tokens t where t.resource_type='request' and t.resource_id=r.id and t.token_hash=p_manage_token_hash and t.revoked_at is null and (t.expires_at is null or t.expires_at>now())) limit 1
$$;
revoke all on function public.get_request_for_manage(text) from public;
grant execute on function public.get_request_for_manage(text) to anon,authenticated;

drop function if exists public.get_order_for_manage(text);
create function public.get_order_for_manage(p_manage_token_hash text)
returns table(
  id uuid,business_id uuid,customer_name text,customer_phone text,customer_email text,
  fulfillment_method text,address text,notes text,total_cents integer,status text,archived boolean,created_at timestamptz,
  payment_status text,currency text,policy_snapshot jsonb,payment_id uuid,amount_paid_cents integer,amount_refunded_cents integer,receipt_url text,
  business_name text,business_slug text,business_email text,items jsonb
) language sql security definer set search_path=public stable as $$
  select o.id,o.business_id,o.customer_name,o.customer_phone,o.customer_email,o.fulfillment_method,o.address,o.notes,o.total_cents,o.status,o.archived,o.created_at,
    o.payment_status,o.currency,o.policy_snapshot,p.id,coalesce(p.amount_paid_cents,0),coalesce(p.amount_refunded_cents,0),p.receipt_url,
    b.name,b.slug,b.email,coalesce((select jsonb_agg(jsonb_build_object('product_name',i.product_name,'unit_price_cents',i.unit_price_cents,'quantity',i.quantity) order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb)
  from public.orders o join public.businesses b on b.id=o.business_id left join public.payments p on p.order_id=o.id
  where o.manage_token_hash=p_manage_token_hash or exists(select 1 from public.customer_access_tokens t where t.resource_type='order' and t.resource_id=o.id and t.token_hash=p_manage_token_hash and t.revoked_at is null and (t.expires_at is null or t.expires_at>now())) limit 1
$$;
revoke all on function public.get_order_for_manage(text) from public;
grant execute on function public.get_order_for_manage(text) to anon,authenticated;

drop function if exists public.get_booking_for_manage(text);
create function public.get_booking_for_manage(p_manage_token_hash text)
returns table(
  id uuid,business_id uuid,service_name text,customer_name text,customer_email text,appointment_date date,start_time time,end_time time,status text,
  total_price_cents integer,amount_due_cents integer,amount_paid_cents integer,payment_status text,currency text,policy_snapshot jsonb,payment_id uuid,receipt_url text,
  business_name text,business_slug text,business_email text,services jsonb
) language sql security definer set search_path=public stable as $$
  select a.id,a.business_id,a.service_name,a.customer_name,a.customer_email,a.appointment_date,a.start_time,a.end_time,a.status,a.total_price_cents,a.amount_due_cents,a.amount_paid_cents,a.payment_status,a.currency,a.policy_snapshot,p.id,p.receipt_url,
    b.name,b.slug,b.email,coalesce((select jsonb_agg(jsonb_build_object('service_name',s.service_name,'price_cents',s.price_cents,'duration_minutes',s.duration_minutes) order by s.display_order) from public.booking_services s where s.appointment_id=a.id),'[]'::jsonb)
  from public.appointments a join public.businesses b on b.id=a.business_id left join public.payments p on p.appointment_id=a.id
  where a.manage_token_hash=p_manage_token_hash or exists(select 1 from public.customer_access_tokens t where t.resource_type='booking' and t.resource_id=a.id and t.token_hash=p_manage_token_hash and t.revoked_at is null and (t.expires_at is null or t.expires_at>now())) limit 1
$$;
revoke all on function public.get_booking_for_manage(text) from public;
grant execute on function public.get_booking_for_manage(text) to anon,authenticated;

alter table public.site_settings
  add column if not exists support_email text,
  add column if not exists default_timezone text not null default 'America/New_York',
  add column if not exists default_currency text not null default 'usd',
  add column if not exists email_sender_name text not null default 'Quicklink',
  add column if not exists email_reply_to text;

commit;
