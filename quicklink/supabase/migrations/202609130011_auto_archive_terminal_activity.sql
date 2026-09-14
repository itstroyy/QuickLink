create or replace function public.quicklink_auto_archive_terminal_activity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status in ('completed', 'cancelled') then new.archived := true; end if;
  return new;
end $$;

drop trigger if exists orders_auto_archive_terminal on public.orders;
create trigger orders_auto_archive_terminal before insert or update of status on public.orders
for each row execute function public.quicklink_auto_archive_terminal_activity();

drop trigger if exists appointments_auto_archive_terminal on public.appointments;
create trigger appointments_auto_archive_terminal before insert or update of status on public.appointments
for each row execute function public.quicklink_auto_archive_terminal_activity();

drop trigger if exists service_requests_auto_archive_terminal on public.service_requests;
create trigger service_requests_auto_archive_terminal before insert or update of status on public.service_requests
for each row execute function public.quicklink_auto_archive_terminal_activity();
