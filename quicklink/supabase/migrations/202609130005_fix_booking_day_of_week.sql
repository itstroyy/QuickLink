-- Hotfix: submit_booking() declared a local variable named day_of_week,
-- which collided with the business_hours.day_of_week column and raised
-- "column reference \"day_of_week\" is ambiguous" on every booking attempt.
-- Safe to run even if 202609130004_booking.sql was already applied — this
-- just redefines the function with the local variable renamed.
-- If you have not yet run 202609130004_booking.sql, its corrected version
-- already includes this fix and you can skip this file.

create or replace function public.submit_booking(
  p_business_id uuid, p_service_id uuid, p_date date, p_start_time time,
  p_name text, p_phone text, p_email text, p_notes text
) returns table(appointment_id uuid, start_time time, end_time time)
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
  config jsonb;
  buffer_minutes integer;
  minimum_notice_minutes integer;
  duration_minutes integer := 30;
  service_row public.services;
  computed_end time;
  v_day_of_week smallint;
  hours_row public.business_hours;
  overlap_count integer;
begin
  if not public.quicklink_feature_enabled(p_business_id, 'booking') then raise exception 'Booking is not available'; end if;
  if nullif(trim(p_name),'') is null or nullif(trim(p_phone),'') is null then raise exception 'Name and phone are required'; end if;
  if p_date is null or p_start_time is null then raise exception 'A date and time are required'; end if;
  if p_date < current_date or (p_date = current_date and p_start_time < localtime) then raise exception 'That time has already passed'; end if;

  select settings into config from public.business_features where business_id = p_business_id and feature_key = 'booking';
  buffer_minutes := coalesce((config->>'buffer_minutes')::integer, 0);
  minimum_notice_minutes := coalesce((config->>'minimum_notice_minutes')::integer, 0);

  if p_service_id is not null then
    select * into service_row from public.services where id = p_service_id and business_id = p_business_id and enabled;
    if service_row.id is null then raise exception 'That service is not available'; end if;
    duration_minutes := coalesce(service_row.duration_minutes, 30);
  end if;

  if (p_date + p_start_time) < (now() + (minimum_notice_minutes || ' minutes')::interval) then
    raise exception 'That time does not meet the minimum booking notice';
  end if;

  computed_end := p_start_time + (duration_minutes || ' minutes')::interval;

  v_day_of_week := extract(dow from p_date);
  select * into hours_row from public.business_hours where business_id = p_business_id and business_hours.day_of_week = v_day_of_week;
  if hours_row.id is not null then
    if hours_row.closed then raise exception 'The business is closed on that day'; end if;
    if hours_row.open_time is not null and p_start_time < hours_row.open_time then raise exception 'That time is before opening hours'; end if;
    if hours_row.close_time is not null and computed_end > hours_row.close_time then raise exception 'That time runs past closing hours'; end if;
  end if;

  select count(*) into overlap_count from public.appointments a
  where a.business_id = p_business_id and a.appointment_date = p_date and a.status <> 'cancelled'
    and (a.start_time - (buffer_minutes || ' minutes')::interval) < computed_end
    and (a.end_time + (buffer_minutes || ' minutes')::interval) > p_start_time;
  if overlap_count > 0 then raise exception 'That time is no longer available'; end if;

  insert into public.appointments(business_id, service_id, service_name, customer_name, customer_phone, customer_email, notes, appointment_date, start_time, end_time)
  values (p_business_id, p_service_id, service_row.name, left(trim(p_name),120), left(trim(p_phone),40), nullif(left(trim(p_email),160),''), nullif(left(trim(p_notes),1500),''), p_date, p_start_time, computed_end)
  returning id into new_id;

  return query select new_id, p_start_time, computed_end;
end $$;

revoke all on function public.submit_booking(uuid, uuid, date, time, text, text, text, text) from public;
grant execute on function public.submit_booking(uuid, uuid, date, time, text, text, text, text) to anon, authenticated;
