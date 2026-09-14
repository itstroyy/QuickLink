alter table public.services add column if not exists bookable boolean not null default true;

alter function public.submit_booking(uuid, uuid, date, time without time zone, text, text, text, text)
  rename to submit_booking_internal_20260913;
revoke all on function public.submit_booking_internal_20260913(uuid, uuid, date, time without time zone, text, text, text, text) from public, anon, authenticated;

create function public.submit_booking(
  p_business_id uuid, p_service_id uuid, p_date date, p_start_time time,
  p_name text, p_phone text, p_email text, p_notes text
) returns table(appointment_id uuid, start_time time, end_time time)
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.services where business_id = p_business_id and enabled and bookable)
     and p_service_id is null then
    raise exception 'Choose a service';
  end if;
  if p_service_id is not null and not exists (
    select 1 from public.services where id = p_service_id and business_id = p_business_id and enabled and bookable
  ) then
    raise exception 'That service is not available for booking';
  end if;
  return query select * from public.submit_booking_internal_20260913(p_business_id, p_service_id, p_date, p_start_time, p_name, p_phone, p_email, p_notes);
end $$;
revoke all on function public.submit_booking(uuid, uuid, date, time without time zone, text, text, text, text) from public;
grant execute on function public.submit_booking(uuid, uuid, date, time without time zone, text, text, text, text) to anon, authenticated;
