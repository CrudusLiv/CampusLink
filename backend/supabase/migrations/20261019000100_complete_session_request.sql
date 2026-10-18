-- Persist a completed session and its support request as one atomic state transition.
-- Both tables and their Completed enum values already exist; no existing rows are rewritten.
create or replace function public.complete_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_session_status text;
  v_requester_id uuid;
  v_volunteer_id uuid;
  v_request_status text;
begin
  select s.request_id, s.status::text, q.requester_id, q.volunteer_id, q.status::text
    into v_request_id, v_session_status, v_requester_id, v_volunteer_id, v_request_status
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

  -- A retry after a successful commit is safe and repairs the paired request status if needed.
  if v_session_status not in ('Scheduled', 'Completed') then
    raise exception 'SESSION_NOT_SCHEDULED' using errcode = 'P0001';
  end if;
  if v_request_status not in ('Accepted', 'Completed') then
    raise exception 'REQUEST_NOT_ACCEPTED' using errcode = 'P0001';
  end if;

  update public.session
    set status = 'Completed', completed_at = coalesce(completed_at, now())
    where session_id = p_session_id;
  update public.support_request
    set status = 'Completed'
    where request_id = v_request_id;
end;
$$;

revoke all on function public.complete_session(uuid) from public, anon;
grant execute on function public.complete_session(uuid) to authenticated;
