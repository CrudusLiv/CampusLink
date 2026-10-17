-- Simplified dev seed for the Sessions module (UC3). Paste into Supabase -> SQL Editor.
-- Run AFTER 20261016000400_sessions_iteration1.sql.
--
-- Only creates support requests between two accounts you have already registered.
-- It does NOT touch profiles or availability: make the volunteer one through the app first
-- (Profile -> Become a volunteer -> /volunteer/setup), otherwise the slot picker will be empty.
-- Safe to re-run. Cleanup is at the bottom.

do $$
declare
  v_seeker_email    text := 'b2300682@helplive.edu.my';  -- Help Seeker
  v_volunteer_email text := 'b2300554@helplive.edu.my';  -- Volunteer
  v_seeker    uuid;
  v_volunteer uuid;
begin
  select user_id into v_seeker    from public.users where lower(email) = v_seeker_email;
  select user_id into v_volunteer from public.users where lower(email) = v_volunteer_email;

  if v_seeker is null or v_volunteer is null then
    raise exception 'Register both accounts on /register first (seeker found: %, volunteer found: %)',
      v_seeker is not null, v_volunteer is not null;
  end if;

  if not exists (select 1 from public.availability where user_id = v_volunteer) then
    raise notice 'The volunteer has no availability yet: finish /volunteer/setup, or the slot picker will be empty.';
  end if;

  -- 2 Accepted (schedule these; two are needed to test double-booking across requests) + 1 Pending
  -- (must NOT be schedulable). requested_date/time are Kuala Lumpur wall time; preferred_time is the same instant.
  insert into public.support_request
    (request_id, requester_id, volunteer_id, category, title, description,
     preferred_time, requested_date, requested_time, support_mode, status)
  select
    r.id, v_seeker, r.vol, r.cat, r.title, 'Sessions seed data.',
    ((current_date + 2) + time '10:00') at time zone 'Asia/Kuala_Lumpur',
    current_date + 2, time '10:00', 'Online', r.st::public.request_status
  from (values
    ('b1b2c3d4-0001-4000-8000-000000000001'::uuid, v_volunteer, 'Programming', 'Sessions seed: Java help',  'Accepted'),
    ('b1b2c3d4-0002-4000-8000-000000000002'::uuid, v_volunteer, 'Database',    'Sessions seed: SQL joins',  'Accepted'),
    ('b1b2c3d4-0003-4000-8000-000000000003'::uuid, null::uuid,  'Programming', 'Sessions seed: still pending', 'Pending')
  ) as r(id, vol, cat, title, st)
  on conflict (request_id) do nothing;
end $$;

-- Check what exists
select request_id, title, status from public.support_request where request_id::text like 'b1b2c3d4-000%';


-- ===== CLEANUP (run separately when finished testing) =====
-- delete from public.session         where request_id::text like 'b1b2c3d4-000%';
-- delete from public.support_request where request_id::text like 'b1b2c3d4-000%';
