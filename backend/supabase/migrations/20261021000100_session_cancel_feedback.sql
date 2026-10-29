-- Iteration 2 (sessions): cancel a session, volunteer-only completion after the start time,
-- and feedback that is read-only once submitted. Reschedule is out of scope.

-- Cancel: either participant, only while the session is still Scheduled. The request stays
-- Accepted, so it goes back to "Waiting for a time" and can be booked again.
create or replace function public.cancel_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_requester_id uuid;
  v_volunteer_id uuid;
begin
  select s.status::text, q.requester_id, q.volunteer_id
    into v_status, v_requester_id, v_volunteer_id
  from public.session s
  join public.support_request q on q.request_id = s.request_id
  where s.session_id = p_session_id
  for update of s;

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

  update public.session
    set status = 'Cancelled', cancelled_at = now()
    where session_id = p_session_id;
end;
$$;

revoke all on function public.cancel_session(uuid) from public, anon;
grant execute on function public.cancel_session(uuid) to authenticated;

-- Complete: now volunteer only, and only once the session has started.
-- A retry on an already Completed session is still a safe no-op.
create or replace function public.complete_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_session_status text;
  v_starts_at timestamptz;
  v_requester_id uuid;
  v_volunteer_id uuid;
  v_request_status text;
begin
  select s.request_id, s.status::text, s.scheduled_datetime, q.requester_id, q.volunteer_id, q.status::text
    into v_request_id, v_session_status, v_starts_at, v_requester_id, v_volunteer_id, v_request_status
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
  if (select auth.uid()) <> v_volunteer_id then
    raise exception 'NOT_VOLUNTEER' using errcode = '42501';
  end if;
  if v_session_status not in ('Scheduled', 'Completed') then
    raise exception 'SESSION_NOT_SCHEDULED' using errcode = 'P0001';
  end if;
  if v_request_status not in ('Accepted', 'Completed') then
    raise exception 'REQUEST_NOT_ACCEPTED' using errcode = 'P0001';
  end if;
  if v_session_status = 'Scheduled' and v_starts_at > now() then
    raise exception 'SESSION_NOT_STARTED' using errcode = 'P0001';
  end if;

  update public.session
    set status = 'Completed', completed_at = coalesce(completed_at, now())
    where session_id = p_session_id;
  update public.support_request
    set status = 'Completed'
    where request_id = v_request_id;
end;
$$;

-- Feedback is one per session and cannot be edited after it is submitted.
drop policy if exists "Requesters can edit feedback for completed sessions" on public.feedback;
revoke update on public.feedback from authenticated;
