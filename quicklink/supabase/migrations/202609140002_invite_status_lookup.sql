-- Additive. Lets an invited (non-admin) user see their own invitation status
-- and business name before they have a business_members row — needed by the
-- branded /auth/finish invite-acceptance screen. Never accepts an email
-- parameter: always keyed off the verified email on the current session, so
-- it cannot be used to probe other people's invitations.
begin;
create or replace function public.my_invitation_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare verified_email text; invitation record; biz_name text;
begin
  select lower(email) into verified_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if verified_email is null then return jsonb_build_object('status', 'no-session'); end if;

  select * into invitation from public.business_invitations where email = verified_email order by created_at desc limit 1;
  if invitation is null then return jsonb_build_object('status', 'none', 'email', verified_email); end if;

  select name into biz_name from public.businesses where id = invitation.business_id;
  if invitation.accepted_at is not null then
    return jsonb_build_object('status', 'accepted', 'business_name', biz_name, 'role', invitation.role, 'email', verified_email);
  elsif invitation.expires_at < now() then
    return jsonb_build_object('status', 'expired', 'business_name', biz_name, 'role', invitation.role, 'email', verified_email, 'expires_at', invitation.expires_at);
  else
    return jsonb_build_object('status', 'pending', 'business_name', biz_name, 'role', invitation.role, 'email', verified_email, 'expires_at', invitation.expires_at);
  end if;
end $$;
revoke all on function public.my_invitation_status() from public;
grant execute on function public.my_invitation_status() to authenticated;
commit;
