-- Secure customer order management. Raw tokens never enter the database;
-- only their SHA-256 hashes are stored and used for token-gated RPCs.

alter table public.orders add column if not exists manage_token_hash text;
create unique index if not exists orders_manage_token_hash_idx
  on public.orders(manage_token_hash) where manage_token_hash is not null;

create or replace function public.submit_quicklink_order_managed(
  p_business_id uuid, p_customer_name text, p_customer_phone text,
  p_method text, p_address text, p_notes text, p_items jsonb,
  p_manage_token_hash text
) returns table(order_id uuid, total_cents integer)
language plpgsql security definer set search_path = public as $$
declare v_order_id uuid; v_total_cents integer;
begin
  if p_manage_token_hash is null or p_manage_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid order manage token';
  end if;
  select created.order_id, created.total_cents into v_order_id, v_total_cents
  from public.submit_quicklink_order(
    p_business_id, p_customer_name, p_customer_phone,
    p_method, p_address, p_notes, p_items
  ) as created;
  update public.orders set manage_token_hash = p_manage_token_hash where id = v_order_id;
  return query select v_order_id, v_total_cents;
end $$;
revoke all on function public.submit_quicklink_order_managed(uuid,text,text,text,text,text,jsonb,text) from public;
grant execute on function public.submit_quicklink_order_managed(uuid,text,text,text,text,text,jsonb,text) to anon, authenticated;

create or replace function public.get_order_for_manage(p_manage_token_hash text)
returns table(
  id uuid, business_id uuid, customer_name text, customer_phone text,
  fulfillment_method text, address text, notes text, total_cents integer,
  status text, archived boolean, created_at timestamptz,
  business_name text, business_slug text, items jsonb
)
language sql security definer set search_path = public stable as $$
  select o.id, o.business_id, o.customer_name, o.customer_phone,
    o.fulfillment_method, o.address, o.notes, o.total_cents,
    o.status, o.archived, o.created_at, b.name, b.slug,
    coalesce((select jsonb_agg(jsonb_build_object(
      'product_name', i.product_name, 'unit_price_cents', i.unit_price_cents,
      'quantity', i.quantity
    ) order by i.id) from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  from public.orders o join public.businesses b on b.id = o.business_id
  where o.manage_token_hash = p_manage_token_hash limit 1
$$;
revoke all on function public.get_order_for_manage(text) from public;
grant execute on function public.get_order_for_manage(text) to anon, authenticated;

create or replace function public.cancel_order_managed(p_manage_token_hash text)
returns text
language plpgsql security definer set search_path = public as $$
declare current_status text;
begin
  select status into current_status from public.orders where manage_token_hash = p_manage_token_hash for update;
  if current_status is null then return 'not_found'; end if;
  if current_status <> 'new' then return 'not_allowed'; end if;
  update public.orders set status = 'cancelled', archived = true where manage_token_hash = p_manage_token_hash;
  return 'cancelled';
end $$;
revoke all on function public.cancel_order_managed(text) from public;
grant execute on function public.cancel_order_managed(text) to anon, authenticated;
