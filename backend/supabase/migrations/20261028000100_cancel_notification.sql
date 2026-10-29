-- Use case 3, step 7a: when a session is cancelled, the other participant is notified.
-- The notification table already exists in production (it was never in a migration), so
-- this file creates it only if missing and then sets its security rules.
create table if not exists public.notification (
  notification_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (user_id) on delete cascade,
  type varchar not null,
  message text not null,
  sent_at timestamptz not null default now(),
  read_status boolean not null default false
);

alter table public.notification enable row level security;

-- People can read their own notifications and mark them read. Nothing else from the browser:
-- rows are written by database functions such as cancel_session.
revoke all on public.notification from anon, authenticated;
grant select on public.notification to authenticated;
grant update (read_status) on public.notification to authenticated;

drop policy if exists "Users read own notifications" on public.notification;
create policy "Users read own notifications"
  on public.notification for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users mark own notifications read" on public.notification;
create policy "Users mark own notifications read"
  on public.notification for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- cancel_session: same rules as before (24 hours notice, request cancelled too) plus the notification.
create or replace function public.cancel_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_status text;
  v_starts_at timestamptz;
  v_title text;
  v_requester_id uuid;
  v_volunteer_id uuid;
  v_caller uuid := (select auth.uid());
  v_caller_name text;
begin
  select s.request_id, s.status::text, s.scheduled_datetime, q.title, q.requester_id, q.volunteer_id
    into v_request_id, v_status, v_starts_at, v_title, v_requester_id, v_volunteer_id
  from public.session s
  join public.support_request q on q.request_id = s.request_id
  where s.session_id = p_session_id
  for update of s, q;

  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_caller is null or v_caller not in (v_requester_id, v_volunteer_id) then
    raise exception 'NOT_PARTICIPANT' using errcode = '42501';
  end if;
  if v_status <> 'Scheduled' then
    raise exception 'SESSION_NOT_SCHEDULED' using errcode = 'P0001';
  end if;
  if v_starts_at - now() < interval '24 hours' then
    raise exception 'CANCEL_TOO_LATE' using errcode = 'P0001';
  end if;

  update public.session
    set status = 'Cancelled', cancelled_at = now()
    where session_id = p_session_id;
  update public.support_request
    set status = 'Cancelled'
    where request_id = v_request_id and status = 'Accepted';

  select name into v_caller_name from public.users where user_id = v_caller;
  insert into public.notification (user_id, type, message)
  values (
    case when v_caller = v_requester_id then v_volunteer_id else v_requester_id end,
    'session_cancelled',
    coalesce(v_caller_name, 'The other participant') || ' cancelled "' || v_title || '" ('
      || to_char(v_starts_at at time zone 'Asia/Kuala_Lumpur', 'Dy, DD Mon, HH12:MI AM') || ').'
  );
end;
$$;

revoke all on function public.cancel_session(uuid) from public, anon;
grant execute on function public.cancel_session(uuid) to authenticated;
