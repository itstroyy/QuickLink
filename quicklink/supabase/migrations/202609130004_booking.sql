-- Native booking module. Run after 202609130003_request_service.sql.
-- No client login/dashboard. Works without Google Calendar; the
-- external_calendar_event_id column below is reserved so a future migration
-- can add Google/Outlook/Apple calendar sync without touching this table.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  notes text,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'new' check (status in ('new','confirmed','completed','cancelled','no_show')),
  external_calendar_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index if not exists appointments_business_date_idx on public.appointments(business_id, appointment_date, start_time);

-- Prevents double-booking at the moment of insert. The submit_booking
-- function below also checks for overlapping appointments (accounting for
-- buffer time and different service durations) before it inserts, but this
-- index is the hard guarantee against a race between two simultaneous
-- bookings for the exact same slot.
create unique index if not exists appointments_no_double_booking_idx
  on public.appointments(business_id, appointment_date, start_time)
  where status <> 'cancelled';

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;
drop policy if exists "Admins read appointments" on public.appointments;
create policy "Admins read appointments" on public.appointments for select to authenticated using (public.is_quicklink_admin());
drop policy if exists "Admins insert appointments" on public.appointments;
create policy "Admins insert appointments" on public.appointments for insert to authenticated with check (public.is_quicklink_admin());
drop policy if exists "Admins update appointments" on public.appointments;
create policy "Admins update appointments" on public.appointments for update to authenticated using (public.is_quicklink_admin()) with check (public.is_quicklink_admin());
drop policy if exists "Admins delete appointments" on public.appointments;
create policy "Admins delete appointments" on public.appointments for delete to authenticated using (public.is_quicklink_admin());
grant all on public.appointments to authenticated;

-- Returns only the booked time ranges for a business/date (no customer
-- details), so the public availability endpoint can compute free slots
-- without exposing any customer's name, phone or email.
create or replace function public.quicklink_booked_ranges(p_business_id uuid, p_date date)
returns table(start_time time, end_time time)
language sql security definer set search_path = public stable
as $$
  select start_time, end_time from public.appointments
  where business_id = p_business_id and appointment_date = p_date and status <> 'cancelled'
$$;
revoke all on function public.quicklink_booked_ranges(uuid, date) from public;
grant execute on function public.quicklink_booked_ranges(uuid, date) to anon, authenticated;

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

insert into public.business_features(business_id, feature_key, enabled, display_order, settings)
select b.id, 'booking', false, 6, jsonb_build_object('button_title','Book Now','buffer_minutes',0,'minimum_notice_minutes',60)
from public.businesses b
on conflict (business_id, feature_key) do nothing;
