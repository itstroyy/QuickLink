-- Add configurable Order Now customer fields and enforce them in the
-- server-authoritative order RPC. Existing orders and order data are kept.
begin;

-- Preserve any existing ordering settings while supplying safe defaults.
update public.business_features
set settings = jsonb_build_object(
  'phone_required', true,
  'show_email', true,
  'email_required', false,
  'show_address', true,
  'address_required', false,
  'show_notes', true
) || coalesce(settings, '{}'::jsonb)
where feature_key = 'ordering';

-- The original orders table required an address for every delivery at the
-- table level. Address requirements are now business-configurable and are
-- enforced atomically by submit_quicklink_order_productized instead.
do $$
declare constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.orders'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%fulfillment_method%'
      and pg_get_constraintdef(c.oid) ilike '%address%'
  loop
    execute format('alter table public.orders drop constraint %I', constraint_name);
  end loop;
end
$$;

create or replace function public.submit_quicklink_order_productized(
  p_business_id uuid, p_customer_name text, p_customer_phone text, p_customer_email text,
  p_method text, p_address text, p_notes text, p_items jsonb, p_manage_token_hash text
) returns table(order_id uuid,total_cents integer,payment_required boolean,currency text)
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;
  v_total integer;
  v_count integer;
  v_requested integer;
  v_settings public.business_payment_settings%rowtype;
  v_required boolean;
  v_config jsonb;
  v_email text := nullif(trim(coalesce(p_customer_email, '')), '');
  v_phone text := trim(coalesce(p_customer_phone, ''));
  v_address text := nullif(trim(coalesce(p_address, '')), '');
begin
  if not public.quicklink_feature_enabled(p_business_id,'ordering') then raise exception 'Ordering is not available'; end if;
  select coalesce(f.settings, '{}'::jsonb) into v_config
  from public.business_features f
  where f.business_id=p_business_id and f.feature_key='ordering';
  v_config := jsonb_build_object(
    'phone_required', true,
    'show_email', true,
    'email_required', false,
    'show_address', true,
    'address_required', false,
    'show_notes', true
  ) || coalesce(v_config, '{}'::jsonb);

  if nullif(trim(coalesce(p_customer_name, '')), '') is null then raise exception 'Name is required'; end if;
  if coalesce((v_config->>'phone_required')::boolean, true) and v_phone = '' then raise exception 'Phone is required'; end if;
  if p_method not in ('pickup','delivery') then raise exception 'Choose pickup or delivery'; end if;
  if coalesce((v_config->>'address_required')::boolean, false) and v_address is null then raise exception 'Address is required'; end if;
  if p_manage_token_hash is null or p_manage_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid order manage token'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>50 then raise exception 'Choose between 1 and 50 products'; end if;

  select * into v_settings from public.business_payment_settings where business_id=p_business_id;
  v_required := coalesce(v_settings.order_payment_mode,'pay_later')='online_required';
  if v_required and (not coalesce(v_settings.stripe_charges_enabled,false) or not coalesce(v_settings.stripe_payouts_enabled,false)) then raise exception 'Online ordering is temporarily unavailable while payments are being configured'; end if;
  if (v_required or coalesce((v_config->>'email_required')::boolean, false)) and v_email is null then raise exception 'Email is required'; end if;
  if v_email is not null and (char_length(v_email)>160 or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Enter a valid email address'; end if;

  select count(*),sum(p.price_cents*r.quantity)::integer into v_count,v_total
  from jsonb_to_recordset(p_items) r(product_id uuid,quantity integer)
  join public.products p on p.id=r.product_id and p.business_id=p_business_id and p.available and not coalesce(p.archived,false)
  where r.quantity between 1 and 99;
  v_requested := jsonb_array_length(p_items);
  if v_count<>v_requested or v_total is null or v_total<0 then raise exception 'One or more products are unavailable'; end if;

  insert into public.orders(business_id,customer_name,customer_phone,customer_email,fulfillment_method,address,notes,total_cents,status,payment_status,currency,payment_expires_at,manage_token_hash,policy_snapshot)
  values(
    p_business_id,left(trim(p_customer_name),120),left(v_phone,40),left(v_email,160),p_method,left(v_address,500),
    case when coalesce((v_config->>'show_notes')::boolean, true) then nullif(left(trim(coalesce(p_notes,'')),1500),'') else null end,
    v_total,case when v_required then 'pending_payment' else 'new' end,case when v_required then 'pending' else 'not_required' end,coalesce(v_settings.currency,'usd'),
    case when v_required then now()+interval '30 minutes' else null end,p_manage_token_hash,
    jsonb_build_object('order_cancellation_policy',coalesce(v_settings.order_cancellation_policy,'new_only'))
  ) returning id into v_id;

  insert into public.order_items(order_id,product_id,product_name,unit_price_cents,quantity)
  select v_id,p.id,p.name,p.price_cents,r.quantity from jsonb_to_recordset(p_items) r(product_id uuid,quantity integer)
  join public.products p on p.id=r.product_id and p.business_id=p_business_id and p.available and not coalesce(p.archived,false)
  where r.quantity between 1 and 99;
  return query select v_id,v_total,v_required,coalesce(v_settings.currency,'usd');
end
$$;

revoke all on function public.submit_quicklink_order_productized(uuid,text,text,text,text,text,text,jsonb,text) from public;
grant execute on function public.submit_quicklink_order_productized(uuid,text,text,text,text,text,text,jsonb,text) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
