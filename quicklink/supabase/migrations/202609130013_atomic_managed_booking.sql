-- Create the appointment and attach its hashed customer-manage token in the
-- same database transaction. This keeps public booking independent of a
-- service-role key while exposing no customer data or raw token.

create or replace function public.submit_booking_managed(
  p_business_id uuid, p_service_id uuid, p_date date, p_start_time time,
  p_name text, p_phone text, p_email text, p_notes text,
  p_manage_token_hash text
) returns table(appointment_id uuid, start_time time, end_time time)
language plpgsql security definer set search_path = public as $$
declare
  v_appointment_id uuid;
  v_start_time time;
  v_end_time time;
begin
  if p_manage_token_hash is null or p_manage_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid booking manage token';
  end if;

  select created.appointment_id, created.start_time, created.end_time
    into v_appointment_id, v_start_time, v_end_time
  from public.submit_booking(
    p_business_id, p_service_id, p_date, p_start_time,
    p_name, p_phone, p_email, p_notes
  ) as created;

  update public.appointments
    set manage_token_hash = p_manage_token_hash
    where id = v_appointment_id;

  return query select v_appointment_id, v_start_time, v_end_time;
end $$;

revoke all on function public.submit_booking_managed(uuid, uuid, date, time, text, text, text, text, text) from public;
grant execute on function public.submit_booking_managed(uuid, uuid, date, time, text, text, text, text, text) to anon, authenticated;

create or replace function public.get_booking_for_manage(p_manage_token_hash text)
returns table(
  id uuid, business_id uuid, service_name text, customer_name text,
  appointment_date date, start_time time, end_time time, status text,
  business_name text, business_slug text
)
language sql security definer set search_path = public stable as $$
  select a.id, a.business_id, a.service_name, a.customer_name,
    a.appointment_date, a.start_time, a.end_time, a.status,
    b.name, b.slug
  from public.appointments a
  join public.businesses b on b.id = a.business_id
  where a.manage_token_hash = p_manage_token_hash
  limit 1
$$;
revoke all on function public.get_booking_for_manage(text) from public;
grant execute on function public.get_booking_for_manage(text) to anon, authenticated;

-- Local development may intentionally omit the service-role key. This
-- token-gated fallback keeps cancellation working there. Production still
-- uses the application status path so connected Google events are removed.
create or replace function public.cancel_booking_managed(p_manage_token_hash text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  changed_id uuid;
begin
  update public.appointments
    set status = 'cancelled', archived = true
    where manage_token_hash = p_manage_token_hash
      and status = 'confirmed'
    returning id into changed_id;
  return changed_id is not null;
end $$;
revoke all on function public.cancel_booking_managed(text) from public;
grant execute on function public.cancel_booking_managed(text) to anon, authenticated;
