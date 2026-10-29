-- Cancelling a session now needs at least 24 hours of notice, and it also cancels the
-- support request, so the Help Seeker does not see "Accepted" with no session behind it.
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
  v_requester_id uuid;
  v_volunteer_id uuid;
begin
  select s.request_id, s.status::text, s.scheduled_datetime, q.requester_id, q.volunteer_id
    into v_request_id, v_status, v_starts_at, v_requester_id, v_volunteer_id
  from public.session s
  join public.support_request q on q.request_id = s.request_id
  where s.session_id = p_session_id
  for update of s, q;

  if not found then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if (select auth.uid()) is null
     or (select auth.uid()) not in (v_requester_id, v_volunteer_id) then
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
end;
$$;

revoke all on function public.cancel_session(uuid) from public, anon;
grant execute on function public.cancel_session(uuid) to authenticated;
