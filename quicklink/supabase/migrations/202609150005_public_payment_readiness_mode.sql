-- Public ordering/booking/quote-payment readiness must reflect whichever
-- Stripe account (test or live) the CURRENTLY ACTIVE secret key can
-- actually charge against. Until now, get_public_payment_config(),
-- submit_quicklink_order_productized() and submit_booking_productized()
-- all read the legacy stripe_charges_enabled / stripe_payouts_enabled
-- columns directly, which the 202609150003 mirror trigger keeps pointed at
-- the LIVE account only. So a business fully enabled in Stripe TEST mode
-- still showed "temporarily unavailable while this business finishes
-- payment setup" on the public page, because the legacy columns (mirroring
-- an unconnected/disconnected live account) never reflected test-mode
-- readiness at all.
--
-- Fix: every one of these functions now takes an explicit p_stripe_mode
-- parameter and reads the matching stripe_test_*/stripe_live_* columns
-- through one shared helper, instead of ever touching the legacy columns
-- for this decision. p_stripe_mode defaults to 'live' (and any value other
-- than the literal 'test' is treated as 'live') so a caller that forgets
-- to pass it gets the strict, real-money behavior — never the reverse. The
-- legacy columns and their mirror trigger are left in place unmodified for
-- backward compatibility with anything else that still reads them.
begin;

-- Single shared source of truth for "is Stripe actually ready to accept a
-- charge for this business, in this mode" — used by every function below
-- so their readiness decisions can't drift apart from each other.
create or replace function public.business_stripe_ready(p_business_id uuid, p_stripe_mode text default 'live')
returns table(account_id text, charges_enabled boolean, payouts_enabled boolean, account_status text, ready boolean)
language sql security definer set search_path = public stable as $$
  select
    case when p_stripe_mode = 'test' then s.stripe_test_account_id else s.stripe_live_account_id end,
    coalesce(case when p_stripe_mode = 'test' then s.stripe_test_charges_enabled else s.stripe_live_charges_enabled end, false),
    coalesce(case when p_stripe_mode = 'test' then s.stripe_test_payouts_enabled else s.stripe_live_payouts_enabled end, false),
    coalesce(case when p_stripe_mode = 'test' then s.stripe_test_account_status else s.stripe_live_account_status end, 'not_connected'),
    coalesce(case when p_stripe_mode = 'test' then s.stripe_test_charges_enabled else s.stripe_live_charges_enabled end, false)
      and coalesce(case when p_stripe_mode = 'test' then s.stripe_test_payouts_enabled else s.stripe_live_payouts_enabled end, false)
  from public.business_payment_settings s
  where s.business_id = p_business_id
$$;
-- Only ever called from inside other security definer functions below, so
-- it's never granted to anon/authenticated directly.
revoke all on function public.business_stripe_ready(uuid, text) from public;

-- Public pages get capability/policy facts without ever seeing a connected
-- account ID. Signature changed (added p_stripe_mode) — drop the old
-- single-arg overload first so PostgREST/Postgres never has two ambiguous
-- candidates for the same call.
drop function if exists public.get_public_payment_config(uuid);
create function public.get_public_payment_config(p_business_id uuid, p_stripe_mode text default 'live')
returns table(
  payments_ready boolean, currency text, order_payment_mode text,
  booking_payment_mode text, deposit_type text, deposit_value integer,
  allow_multiple_services boolean, booking_refund_policy text,
  cancellation_window_hours integer, deposit_refund_policy text,
  order_cancellation_policy text
) language sql security definer set search_path = public stable as $$
  select r.ready, s.currency,
    s.order_payment_mode, s.booking_payment_mode, s.deposit_type, s.deposit_value,
    s.allow_multiple_services, s.booking_refund_policy, s.cancellation_window_hours,
    s.deposit_refund_policy, s.order_cancellation_policy
  from public.business_payment_settings s
  join public.businesses b on b.id = s.business_id
  cross join public.business_stripe_ready(p_business_id, p_stripe_mode) r
  where s.business_id = p_business_id and b.status = 'active'
$$;
revoke all on function public.get_public_payment_config(uuid, text) from public;
grant execute on function public.get_public_payment_config(uuid, text) to anon, authenticated;

-- Same treatment: drop the old signature, recreate with a trailing
-- p_stripe_mode default 'live', and swap the readiness check to the shared
-- helper instead of v_settings.stripe_charges_enabled/stripe_payouts_enabled.
drop function if exists public.submit_quicklink_order_productized(uuid,text,text,text,text,text,text,jsonb,text);
create function public.submit_quicklink_order_productized(
  p_business_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text,
  p_method text, p_address text, p_notes text, p_items jsonb, p_manage_token_hash text,
  p_stripe_mode text default 'live'
) returns table(order_id uuid,total_cents integer,payment_required boolean,currency text)
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_total integer; v_count integer; v_requested integer; v_settings public.business_payment_settings%rowtype; v_required boolean; v_ready boolean;
begin
  if not public.quicklink_feature_enabled(p_business_id,'ordering') then raise exception 'Ordering is not available'; end if;
  if nullif(trim(p_customer_name),'') is null or nullif(trim(p_customer_phone),'') is null then raise exception 'Name and phone are required'; end if;
  if p_method not in ('pickup','delivery') or (p_method='delivery' and nullif(trim(p_address),'') is null) then raise exception 'Invalid fulfillment details'; end if;
  if p_manage_token_hash is null or p_manage_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid order manage token'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50 then raise exception 'Choose between 1 and 50 products'; end if;
  select * into v_settings from public.business_payment_settings where business_id=p_business_id;
  select ready into v_ready from public.business_stripe_ready(p_business_id, p_stripe_mode);
  v_required := coalesce(v_settings.order_payment_mode,'pay_later')='online_required';
  if v_required and not coalesce(v_ready,false) then raise exception 'Online ordering is temporarily unavailable while payments are being configured'; end if;
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
revoke all on function public.submit_quicklink_order_productized(uuid,text,text,text,text,text,text,jsonb,text,text) from public;
grant execute on function public.submit_quicklink_order_productized(uuid,text,text,text,text,text,text,jsonb,text,text) to anon,authenticated;

drop function if exists public.submit_booking_productized(uuid,uuid[],date,time,text,text,text,text,text);
create function public.submit_booking_productized(
  p_business_id uuid,p_service_ids uuid[],p_date date,p_start_time time,
  p_name text,p_phone text,p_email text,p_notes text,p_manage_token_hash text,
  p_stripe_mode text default 'live'
) returns table(appointment_id uuid,start_time time,end_time time,total_price_cents integer,amount_due_cents integer,payment_required boolean,currency text)
language plpgsql security definer set search_path=public as $$
declare v_settings public.business_payment_settings%rowtype; v_feature jsonb; v_count integer; v_duration integer; v_total integer; v_due integer; v_end time; v_id uuid; v_mode text; v_buffer integer; v_open time; v_close time; v_closed boolean; v_ready boolean;
begin
  if not public.quicklink_feature_enabled(p_business_id,'booking') then raise exception 'Booking is not available'; end if;
  if p_date<current_date or nullif(trim(p_name),'') is null or nullif(trim(p_phone),'') is null then raise exception 'Missing required booking details'; end if;
  if p_manage_token_hash is null or p_manage_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid booking manage token'; end if;
  if coalesce(cardinality(p_service_ids),0)<1 or cardinality(p_service_ids)>12 then raise exception 'Choose at least one service'; end if;
  select settings into v_feature from public.business_features where business_id=p_business_id and feature_key='booking' and enabled;
  select * into v_settings from public.business_payment_settings where business_id=p_business_id;
  select ready into v_ready from public.business_stripe_ready(p_business_id, p_stripe_mode);
  if cardinality(p_service_ids)>1 and not coalesce(v_settings.allow_multiple_services,false) then raise exception 'This business accepts one service per booking'; end if;
  select count(*),sum(coalesce(duration_minutes,30))::integer,sum(coalesce(price_cents,0))::integer into v_count,v_duration,v_total
  from public.services where business_id=p_business_id and enabled and bookable and action_type='bookable' and id=any(p_service_ids);
  if v_count<>cardinality(p_service_ids) then raise exception 'One or more services are unavailable'; end if;
  v_mode:=coalesce(v_settings.booking_payment_mode,'none');
  if v_mode='full' then v_due:=v_total;
  elsif v_mode='deposit' then
    v_due:=case when v_settings.deposit_type='fixed' then least(v_total,v_settings.deposit_value) else least(v_total,ceil(v_total*v_settings.deposit_value/100.0)::integer) end;
  else v_due:=0; end if;
  if v_due>0 and not coalesce(v_ready,false) then raise exception 'Online booking is temporarily unavailable while payments are being configured'; end if;
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
revoke all on function public.submit_booking_productized(uuid,uuid[],date,time,text,text,text,text,text,text) from public;
grant execute on function public.submit_booking_productized(uuid,uuid[],date,time,text,text,text,text,text,text) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
