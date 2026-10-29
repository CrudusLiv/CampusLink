-- FR16: where / how to join a session (a meeting link for Online, a place for In-Person).
-- A volunteer can save a default; every new booking copies it, and the volunteer can change it per session.

alter table public.session
  add column if not exists join_details text check (join_details is null or char_length(join_details) <= 300);
alter table public.volunteer_profile
  add column if not exists join_details text check (join_details is null or char_length(join_details) <= 300);

-- New bookings start with the volunteer's saved default (the booking code does not need to know about this).
create or replace function public.session_default_join_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.join_details is null then
    select vp.join_details into new.join_details
    from public.support_request q
    join public.volunteer_profile vp on vp.user_id = q.volunteer_id
    where q.request_id = new.request_id;
  end if;
  return new;
end;
$$;

drop trigger if exists session_default_join_details on public.session;
create trigger session_default_join_details
  before insert on public.session
  for each row execute function public.session_default_join_details();

-- Only the volunteer of a Scheduled session can set it (sessions have no UPDATE policy, so this is the only way).
create or replace function public.set_session_join_details(p_session_id uuid, p_details text, p_save_default boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_volunteer uuid;
  v_details text := nullif(btrim(coalesce(p_details, '')), '');
begin
  select s.status::text, q.volunteer_id into v_status, v_volunteer
  from public.session s
  join public.support_request q on q.request_id = s.request_id
  where s.session_id = p_session_id
  for update of s;

  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if (select auth.uid()) is null or (select auth.uid()) <> v_volunteer then
    raise exception 'NOT_VOLUNTEER' using errcode = '42501';
  end if;
  if v_status <> 'Scheduled' then
    raise exception 'SESSION_NOT_SCHEDULED' using errcode = 'P0001';
  end if;
  if v_details is not null and char_length(v_details) > 300 then
    raise exception 'DETAILS_TOO_LONG' using errcode = 'P0001';
  end if;

  update public.session set join_details = v_details where session_id = p_session_id;
  if p_save_default then
    update public.volunteer_profile set join_details = v_details where user_id = v_volunteer;
  end if;
end;
$$;

revoke all on function public.set_session_join_details(uuid, text, boolean) from public, anon;
grant execute on function public.set_session_join_details(uuid, text, boolean) to authenticated;
