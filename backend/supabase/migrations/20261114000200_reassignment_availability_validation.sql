  -- Recheck availability and commitments inside the locked reassignment transaction.
  -- The API performs the same lookups for friendly field errors; this function is the
  -- authoritative guard against direct RPC calls and concurrent schedule changes.
  create or replace function public.reassign_pending_support_request(
    p_request_id uuid,
    p_expected_volunteer_id uuid,
    p_new_volunteer_id uuid
  )
  returns integer
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_request public.support_request%rowtype;
    v_caller uuid := (select auth.uid());
    v_volunteer public.volunteer_profile%rowtype;
    v_local timestamp;
    v_start integer;
  begin
    if v_caller is null then
      raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
    end if;
    if p_new_volunteer_id is null or p_new_volunteer_id = p_expected_volunteer_id or p_new_volunteer_id = v_caller then
      raise exception 'INVALID_VOLUNTEER' using errcode = '22023';
    end if;

    select * into v_request from public.support_request
    where request_id = p_request_id for update;
    if not found or v_request.requester_id <> v_caller then
      raise exception 'REQUEST_NOT_OWNED' using errcode = '42501';
    end if;
    if v_request.status::text <> 'Pending' then
      raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
    end if;
    if v_request.volunteer_id is distinct from p_expected_volunteer_id then
      raise exception 'ASSIGNMENT_CHANGED' using errcode = 'P0001';
    end if;

    -- Match session_guard's participant locks so simultaneous bookings/reassignments
    -- cannot both pass the schedule checks for this volunteer.
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(least(v_request.requester_id, p_new_volunteer_id)::text, 0));
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(greatest(v_request.requester_id, p_new_volunteer_id)::text, 0));

    select * into v_volunteer from public.volunteer_profile
    where user_id = p_new_volunteer_id and is_volunteer = true;
    if not found or not (v_request.category = any(coalesce(v_volunteer.skills, array[]::text[]))) then
      raise exception 'VOLUNTEER_INELIGIBLE' using errcode = '23503';
    end if;

    if v_request.preferred_time is null then
      raise exception 'PREFERRED_TIME_REQUIRED' using errcode = '22023';
    end if;

    v_local := v_request.preferred_time at time zone 'Asia/Kuala_Lumpur';
    v_start := extract(hour from v_local)::integer * 60 + extract(minute from v_local)::integer;
    if not exists (
      select 1 from public.availability a
      where a.user_id = p_new_volunteer_id
        and a.day_of_week::text = (array['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])[extract(dow from v_local)::integer + 1]
        and v_start >= extract(epoch from a.start_time) / 60
        and v_start + 60 <= extract(epoch from a.end_time) / 60
    ) then
      raise exception 'VOLUNTEER_UNAVAILABLE' using errcode = 'P0001';
    end if;

    if exists (
      select 1 from public.support_request r
      where r.volunteer_id = p_new_volunteer_id
        and r.status::text = 'Accepted'
        and r.preferred_time is not null
        and r.preferred_time < v_request.preferred_time + interval '60 minutes'
        and r.preferred_time + interval '60 minutes' > v_request.preferred_time
    ) or exists (
      select 1 from public.session s
      join public.support_request r on r.request_id = s.request_id
      where s.status::text = 'Scheduled'
        and s.scheduled_datetime > v_request.preferred_time - interval '60 minutes'
        and s.scheduled_datetime < v_request.preferred_time + interval '60 minutes'
        and (r.requester_id in (v_request.requester_id, p_new_volunteer_id)
          or r.volunteer_id in (v_request.requester_id, p_new_volunteer_id))
    ) then
      raise exception 'VOLUNTEER_TIME_CONFLICT' using errcode = 'P0001';
    end if;

    update public.support_request set volunteer_id = p_new_volunteer_id
    where request_id = p_request_id;
    insert into public.notification (user_id, type, message, event_key, request_id)
    values (
      p_new_volunteer_id,
      'request_pending',
      'You received a new support request: "' || v_request.title || '".',
      'request:' || v_request.request_id::text || ':assignment:' || (v_request.assignment_version + 1)::text,
      v_request.request_id
    ) on conflict (event_key) where event_key is not null do nothing;
    return (select assignment_version from public.support_request where request_id = p_request_id);
  end;
  $$;
