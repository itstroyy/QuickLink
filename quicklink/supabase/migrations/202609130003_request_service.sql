-- Consolidate Delivery and Quote into one flexible Request Service module.
-- Run after 202609130002_orders_delivery_quotes.sql.

alter table public.business_features drop constraint if exists business_features_feature_key_check;
alter table public.business_features add constraint business_features_feature_key_check check (feature_key in (
  'services','special_offers','business_hours','announcements','gallery','contact_form','booking','ordering',
  'request_service','delivery','quote_request','pricing','google_reviews','loyalty','referrals','text_list','email_list','menu','reorder'
));

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  address text,
  preferred_date date,
  request_details text,
  notes text,
  form_data jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','contacted','scheduled','completed','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_requests_business_created_idx on public.service_requests(business_id, created_at desc);
drop trigger if exists service_requests_set_updated_at on public.service_requests;
create trigger service_requests_set_updated_at before update on public.service_requests for each row execute function public.set_updated_at();

alter table public.service_requests enable row level security;
drop policy if exists "Admins read service_requests" on public.service_requests;
create policy "Admins read service_requests" on public.service_requests for select to authenticated using (public.is_quicklink_admin());
drop policy if exists "Admins insert service_requests" on public.service_requests;
create policy "Admins insert service_requests" on public.service_requests for insert to authenticated with check (public.is_quicklink_admin());
drop policy if exists "Admins update service_requests" on public.service_requests;
create policy "Admins update service_requests" on public.service_requests for update to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin());
drop policy if exists "Admins delete service_requests" on public.service_requests;
create policy "Admins delete service_requests" on public.service_requests for delete to authenticated using (public.is_quicklink_admin());
grant all on public.service_requests to authenticated;

insert into public.business_features(business_id, feature_key, enabled, is_primary, display_order, settings)
select b.id, 'request_service',
  exists(select 1 from public.business_features old where old.business_id=b.id and old.feature_key in ('delivery','quote_request') and old.enabled),
  false, 1,
  jsonb_build_object(
    'title', case
      when exists(select 1 from public.business_features old where old.business_id=b.id and old.feature_key='delivery' and old.enabled)
       and not exists(select 1 from public.business_features old where old.business_id=b.id and old.feature_key='quote_request' and old.enabled) then 'Request Delivery'
      when exists(select 1 from public.business_features old where old.business_id=b.id and old.feature_key='quote_request' and old.enabled)
       and not exists(select 1 from public.business_features old where old.business_id=b.id and old.feature_key='delivery' and old.enabled) then 'Get a Quote'
      else 'Request Service' end,
    'description', 'Tell us what you need and we’ll follow up.',
    'show_request', true,
    'show_address', exists(select 1 from public.business_features old where old.business_id=b.id and old.feature_key='delivery' and old.enabled),
    'address_required', exists(select 1 from public.business_features old where old.business_id=b.id and old.feature_key='delivery' and old.enabled),
    'show_preferred_date', true, 'show_email', true, 'email_required', false, 'show_notes', true,
    'sms_enabled', exists(select 1 from public.business_notification_settings n where n.business_id=b.id and (n.delivery_sms or n.quote_sms))
  )
from public.businesses b
on conflict(business_id,feature_key) do nothing;

-- Preserve all previous delivery and quote submissions in the unified inbox.
insert into public.service_requests(id,business_id,customer_name,customer_phone,address,request_details,notes,status,created_at,updated_at,form_data)
select id,business_id,customer_name,customer_phone,address,items,notes,
  case when status='new' then 'new' when status in ('completed','cancelled') then 'closed' else 'contacted' end,
  created_at,updated_at,jsonb_build_object('legacy_type','delivery')
from public.delivery_requests on conflict(id) do nothing;

insert into public.service_requests(id,business_id,customer_name,customer_phone,customer_email,address,preferred_date,request_details,notes,status,created_at,updated_at,form_data)
select id,business_id,customer_name,customer_phone,customer_email,address,preferred_date,
  concat_ws(E'\n',service_needed,description),notes,
  case when status='new' then 'new' when status='closed' then 'closed' else 'contacted' end,
  created_at,updated_at,jsonb_build_object('legacy_type','quote')
from public.quote_requests on conflict(id) do nothing;

-- Remove the legacy feature choices so the admin and public page expose one module only.
delete from public.business_features where feature_key in ('delivery','quote_request');
alter table public.business_features drop constraint business_features_feature_key_check;
alter table public.business_features add constraint business_features_feature_key_check check (feature_key in (
  'services','special_offers','business_hours','announcements','gallery','contact_form','booking','ordering',
  'request_service','pricing','google_reviews','loyalty','referrals','text_list','email_list','menu','reorder'
));
update public.business_features target set is_primary=true
where target.feature_key='request_service' and target.enabled
and not exists(select 1 from public.business_features other where other.business_id=target.business_id and other.is_primary);

create or replace function public.submit_service_request(
  p_business_id uuid,p_name text,p_phone text,p_email text,p_address text,p_preferred_date date,
  p_request text,p_notes text,p_form_data jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; config jsonb;
begin
  if not public.quicklink_feature_enabled(p_business_id,'request_service') then raise exception 'Service requests are not available'; end if;
  select settings into config from public.business_features where business_id=p_business_id and feature_key='request_service';
  if nullif(trim(p_name),'') is null or nullif(trim(p_phone),'') is null then raise exception 'Name and phone are required'; end if;
  if coalesce((config->>'address_required')::boolean,false) and nullif(trim(p_address),'') is null then raise exception 'Address is required'; end if;
  if coalesce((config->>'email_required')::boolean,false) and nullif(trim(p_email),'') is null then raise exception 'Email is required'; end if;
  if coalesce((config->>'show_request')::boolean,true) and nullif(trim(p_request),'') is null then raise exception 'Request details are required'; end if;
  insert into public.service_requests(business_id,customer_name,customer_phone,customer_email,address,preferred_date,request_details,notes,form_data)
  values(p_business_id,left(trim(p_name),120),left(trim(p_phone),40),nullif(left(trim(p_email),160),''),nullif(left(trim(p_address),500),''),p_preferred_date,nullif(left(trim(p_request),2500),''),nullif(left(trim(p_notes),1500),''),coalesce(p_form_data,'{}'::jsonb))
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.submit_service_request(uuid,text,text,text,text,date,text,text,jsonb) from public;
grant execute on function public.submit_service_request(uuid,text,text,text,text,date,text,text,jsonb) to anon,authenticated;
