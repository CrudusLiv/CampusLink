-- Sessions, Iteration 1 (Epic 3: US1 Schedule, US2 Upcoming). Additive and re-runnable.
-- The session table and the enums (support_mode, session_status, request_status) already exist.
-- Deliberate deviations from the data dictionary: meeting_link (US8 note) and created_at.


-- 1. SESSION: extra columns, https-only meeting link
alter table public.session
  add column if not exists meeting_link text,
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'session_meeting_link_https') then
    alter table public.session
      add constraint session_meeting_link_https
      check (meeting_link is null or meeting_link ~* '^https://\S+$');
  end if;
end $$;


-- 2. Indexes + business rule: only ONE Scheduled session per request
create index if not exists session_request_id_idx on public.session (request_id);
create index if not exists session_scheduled_datetime_idx on public.session (scheduled_datetime);
create unique index if not exists session_one_active_per_request
  on public.session (request_id) where status = 'Scheduled';


-- 3. Double-booking guard. Runs in the database so two people booking at the same moment
--    cannot both win. SECURITY DEFINER because it must see the OTHER participant's sessions
--    on their other requests, which row-level security hides from the caller.
--    The 60 minutes matches SLOT_MINUTES in lib/sessions/slots.ts (sessions have no end column).
create or replace function public.session_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester uuid;
  v_volunteer uuid;
  v_local     timestamp;
  v_mins      int;
begin
  if new.scheduled_datetime <= now() then
    raise exception 'PAST_SLOT';
  end if;

  select requester_id, volunteer_id into v_requester, v_volunteer
  from public.support_request where request_id = new.request_id;
  if v_requester is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  -- BEFORE triggers run ahead of row-level security, so check membership here first. Otherwise the
  -- errors below would tell an outsider whether someone else's volunteer is busy. (auth.uid() is
  -- null only for the SQL Editor / service role, which is allowed.)
  if auth.uid() is not null and auth.uid() not in (v_requester, coalesce(v_volunteer, v_requester)) then
    raise exception 'NOT_PARTICIPANT';
  end if;
  if v_volunteer is null then
    raise exception 'NO_VOLUNTEER';
  end if;

  -- The whole hour must fall inside one of the volunteer's weekly availability blocks,
  -- read as Kuala Lumpur time. Enforced here (not only in the API) because the browser can
  -- talk to the database directly with the user's own login.
  v_local := new.scheduled_datetime at time zone 'Asia/Kuala_Lumpur';
  v_mins  := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  if not exists (
    select 1 from public.availability a
    where a.user_id = v_volunteer
      and a.day_of_week::text = (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[extract(dow from v_local)::int + 1]
      and v_mins      >= extract(epoch from a.start_time) / 60
      and v_mins + 60 <= extract(epoch from a.end_time) / 60
  ) then
    raise exception 'OUTSIDE_AVAILABILITY';
  end if;

  -- Serialise bookings per person. Locks are taken in sorted order so they cannot deadlock.
  perform pg_advisory_xact_lock(hashtextextended(least(v_requester, coalesce(v_volunteer, v_requester))::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(v_requester, coalesce(v_volunteer, v_requester))::text, 0));

  if exists (
    select 1
    from public.session s
    join public.support_request q on q.request_id = s.request_id
    where s.status = 'Scheduled'
      and s.session_id is distinct from new.session_id
      and s.scheduled_datetime >  new.scheduled_datetime - interval '60 minutes'
      and s.scheduled_datetime <  new.scheduled_datetime + interval '60 minutes'
      and (q.requester_id in (v_requester, v_volunteer) or q.volunteer_id in (v_requester, v_volunteer))
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  return new;
end;
$$;

revoke all on function public.session_guard() from public, anon, authenticated;

drop trigger if exists session_guard_trg on public.session;
create trigger session_guard_trg
  before insert on public.session
  for each row execute function public.session_guard();


-- 4. Busy times for the slot picker: start times only, for the two participants of a request
--    the caller belongs to. Nothing else about the other sessions is revealed (NFR8).
create or replace function public.get_busy_times(p_request_id uuid)
returns table (scheduled_datetime timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select requester_id, volunteer_id
    from public.support_request
    where request_id = p_request_id
      and (select auth.uid()) in (requester_id, volunteer_id)
  )
  select s.scheduled_datetime
  from public.session s
  join public.support_request q on q.request_id = s.request_id
  cross join me
  where s.status = 'Scheduled'
    and s.scheduled_datetime >= now()
    and (q.requester_id in (me.requester_id, me.volunteer_id) or q.volunteer_id in (me.requester_id, me.volunteer_id))
$$;

revoke all on function public.get_busy_times(uuid) from public, anon;
grant execute on function public.get_busy_times(uuid) to authenticated;


-- 5. Row Level Security (NFR1)
-- Least privilege: signed-out visitors get nothing, signed-in users can only read and insert.
-- (UPDATE and DELETE are removed at the privilege level too, not just by the lack of policies.)
revoke all on public.session from anon, authenticated;
grant select, insert on public.session to authenticated;

alter table public.session enable row level security;

-- SESSION: participants can read; participants can create a Scheduled session for an Accepted request.
-- No UPDATE or DELETE policies yet (Iteration 2).
-- Same name as the policy in 20261017000100_feedback_authoritative_rating.sql, so running both leaves ONE policy.
drop policy if exists "Session participants can view sessions" on public.session;
create policy "Session participants can view sessions"
  on public.session for select
  to authenticated
  using (exists (
    select 1 from public.support_request q
    where q.request_id = session.request_id
      and (select auth.uid()) in (q.requester_id, q.volunteer_id)
  ));

drop policy if exists "Participants can schedule a session" on public.session;
create policy "Participants can schedule a session"
  on public.session for insert
  to authenticated
  with check (
    status = 'Scheduled' and completed_at is null and cancelled_at is null
    and exists (
      select 1 from public.support_request q
      where q.request_id = session.request_id
        and q.status = 'Accepted'
        and (select auth.uid()) in (q.requester_id, q.volunteer_id)
    )
  );

-- Nothing to add for SUPPORT_REQUEST or AVAILABILITY. The policies above rely on these, which already exist:
--   support_request: "Users can view their own support requests" + "Volunteers can view assigned support requests"
--                    (20261016000200_support_request_schema_and_data.sql)
--   availability:    "Signed-in users can view availability" (20261014_volunteer_setup.sql)
-- That is why this file must run AFTER them.
