-- Demo data so the site looks populated (volunteer list, dashboards, My Sessions, history, ratings).
-- Run in the Supabase SQL editor, or: cd backend && npx supabase db query --linked -f supabase/seed-demo.sql
--
-- Adds 5 fake accounts (demo.*@helplive.edu.my, student IDs BDEMO001 to BDEMO005; no inbox, random password nobody knows,
-- so nobody can log in as them) and requests, sessions and ratings around the account b2300682@helplive.edu.my.
-- Dates are relative to today, so re-run the cleanup and this file to refresh them.
-- All-or-nothing: it is one DO block. Cleanup is at the bottom. It does not touch the b1b2c3d4-* sessions test data.

do $$
declare
  v_me    uuid;
  v_aisha uuid := gen_random_uuid();
  v_daniel uuid := gen_random_uuid();
  v_priya uuid := gen_random_uuid();
  v_wei   uuid := gen_random_uuid();
  v_sara  uuid := gen_random_uuid();
  v_pw    text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');  -- discarded when this block ends
  r       record;
  v_session uuid;
  -- next date (strictly after today) that falls on ISO weekday d (1 = Mon ... 7 = Sun)
  d_mon date := current_date + ((1 - extract(isodow from current_date)::int + 6) % 7) + 1;
  d_tue date := current_date + ((2 - extract(isodow from current_date)::int + 6) % 7) + 1;
  d_wed date := current_date + ((3 - extract(isodow from current_date)::int + 6) % 7) + 1;
  d_thu date := current_date + ((4 - extract(isodow from current_date)::int + 6) % 7) + 1;
  d_fri date := current_date + ((5 - extract(isodow from current_date)::int + 6) % 7) + 1;
begin
  select user_id into v_me from public.users where lower(email) = 'b2300682@helplive.edu.my';
  if v_me is null then raise exception 'b2300682 has no profile row.'; end if;
  if exists (select 1 from auth.users where email like 'demo.%@helplive.edu.my') then
    raise exception 'Demo accounts already exist. Run the cleanup at the bottom of this file first.';
  end if;

  -- 1. accounts (the sign-up trigger creates each public.users row from the metadata)
  for r in select * from (values
      (v_aisha,  'demo.aisha.rahman@helplive.edu.my',  'Aisha Rahman',  'BDEMO001'),
      (v_daniel, 'demo.daniel.lim@helplive.edu.my',    'Daniel Lim',    'BDEMO002'),
      (v_priya,  'demo.priya.nair@helplive.edu.my',    'Priya Nair',    'BDEMO003'),
      (v_wei,    'demo.weijie.tan@helplive.edu.my',    'Tan Wei Jie',   'BDEMO004'),
      (v_sara,   'demo.sara.abdullah@helplive.edu.my', 'Sara Abdullah', 'BDEMO005')) as t(id, email, nm, sid)
  loop
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      r.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', r.email,
      extensions.crypt(v_pw, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', r.nm, 'student_id', r.sid), now(), now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (r.id::text, r.id,
            jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true, 'phone_verified', false),
            'email', now(), now(), now());
  end loop;

  update public.users set faculty = 'Faculty of Computing', bio = 'Third-year student who enjoys explaining programming and databases.' where user_id = v_aisha;
  update public.users set faculty = 'Faculty of Science', bio = 'Maths and study-skills tutor. Happy to go through past-year papers.' where user_id = v_daniel;
  update public.users set faculty = 'Faculty of Business', bio = 'Peer mentor for first-years: orientation, time management and wellbeing.' where user_id = v_priya;
  update public.users set faculty = 'Faculty of Computing' where user_id = v_wei;
  update public.users set faculty = 'Faculty of Business' where user_id = v_sara;

  -- 2. volunteers: skills and weekly availability (Kuala Lumpur time)
  insert into public.volunteer_profile (user_id, skills, interests, is_volunteer) values
    (v_aisha,  array['Programming','Database'],              array['Java','SQL','Web development'], true),
    (v_daniel, array['Mathematics','Study Skills'],          array['Calculus','Statistics'],        true),
    (v_priya,  array['Campus Orientation','Wellbeing'],      array['Time management','Peer mentoring'], true);
  insert into public.availability (user_id, day_of_week, start_time, end_time) values
    (v_aisha,  'Mon', '10:00', '17:00'), (v_aisha,  'Wed', '10:00', '17:00'),
    (v_daniel, 'Tue', '09:00', '16:00'), (v_daniel, 'Thu', '09:00', '16:00'),
    (v_priya,  'Mon', '13:00', '20:00'), (v_priya,  'Fri', '13:00', '20:00');

  -- 3. requests. requested_date/time are Kuala Lumpur wall time; preferred_time is the same instant.
  -- Ids d3d3d3d3-00NN-... so the cleanup can find them.
  insert into public.support_request (request_id, requester_id, volunteer_id, category, title, description, preferred_time, requested_date, requested_time, support_mode, status)
  select ('d3d3d3d3-00' || lpad(n::text, 2, '0') || '-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
         req, vol, cat, ttl, dsc, ((dt + tm) at time zone 'Asia/Kuala_Lumpur'), dt, tm, md, st::request_status
  from (values
    -- incoming to b2300682 (as volunteer): Pending, so Accept can be demoed. #3 is a Tuesday, outside his Monday availability.
    (1,  v_sara, v_me, 'Programming',        'Help with Java loops',               'Stuck on nested loops in my lab exercise.',            d_mon,       time '14:00', 'Online',    'Pending'),
    (2,  v_wei,  v_me, 'Database',           'SQL joins for assignment 2',         'Not sure which join to use for the report query.',     d_mon + 7,   time '11:00', 'Chat',      'Pending'),
    (3,  v_sara, v_me, 'Campus Orientation', 'Where to find the library services', 'New student, need a walkthrough of the library.',      d_tue,       time '09:00', 'In-Person', 'Pending'),
    -- b2300682 as the student, with sessions
    (4,  v_me,   v_aisha,  'Programming',        'Debugging my Java project',      'Null pointer errors I cannot trace.',                  d_wed,       time '15:00', 'Online',    'Accepted'),
    (5,  v_me,   v_daniel, 'Mathematics',        'Probability revision',           'Preparing for the statistics test.',                   d_thu,       time '10:00', 'Chat',      'Accepted'),
    (6,  v_me,   v_priya,  'Campus Orientation', 'Planning my study timetable',    'How to balance classes and club activities.',          d_fri,       time '14:00', 'In-Person', 'Accepted'),
    -- b2300682 as the volunteer, with a session
    (7,  v_wei,  v_me, 'Programming',        'Intro to Git branches',              'Need help understanding merge conflicts.',             d_mon + 7,   time '15:00', 'Online',    'Accepted'),
    -- other people, so the lists are not only about one account
    (8,  v_wei,  v_aisha,  'Database',           'Normalisation exercise',         'Checking my 3NF answer.',                              d_wed + 7,   time '11:00', 'Online',    'Pending'),
    (9,  v_sara, v_daniel, 'Mathematics',        'Integration by parts',           'Practice questions please.',                           d_tue + 7,   time '10:00', 'Chat',      'Pending'),
    -- history (past dates, no session needed)
    (10, v_wei,  v_me, 'Programming',        'Python basics',                      'First week of the Python module.',                     current_date - 12, time '10:00', 'Online',  'Completed'),
    (11, v_sara, v_me, 'Programming',        'Debugging my Java project',          'Exceptions in a small console app.',                   current_date - 9,  time '14:00', 'Online',  'Completed'),
    (12, v_me,   v_aisha, 'Database',        'Help with ER diagrams',              'Weak and strong entities.',                            current_date - 8,  time '11:00', 'Online',  'Completed'),
    (13, v_wei,  v_me, 'Wellbeing',          'Exam stress tips',                   'Looking for a calm study routine.',                    current_date - 6,  time '16:00', 'Chat',    'Declined'),
    (14, v_me,   v_priya, 'Wellbeing',       'Managing deadlines',                 'Three assignments due in one week.',                   current_date - 5,  time '15:00', 'Chat',    'Cancelled')
  ) as t(n, req, vol, cat, ttl, dsc, dt, tm, md, st);

  -- 4. sessions for the Accepted requests (the guard checks availability and clashes, so these are real bookable slots)
  insert into public.session (request_id, scheduled_datetime, support_mode, meeting_link)
  select request_id, preferred_time, support_mode::public.support_mode, case when support_mode = 'Online' then 'https://meet.google.com/demo-' || right(request_id::text, 4) end
  from public.support_request
  where request_id::text like 'd3d3d3d3-%' and status = 'Accepted';

  -- 5. past sessions with ratings. The guard refuses past times, so it is switched off for these inserts only
  -- (same transaction: if anything fails, it is back on and nothing is saved).
  alter table public.session disable trigger session_guard_trg;
  for r in select * from (values (10, 5, 'Very patient and clear. Cleared up my confusion quickly.'),
                                 (11, 4, 'Helpful session, the examples were great.'),
                                 (12, 5, 'Explained entities with simple diagrams. Thank you!')) as t(n, rating, comment)
  loop
    insert into public.session (request_id, scheduled_datetime, support_mode, status, completed_at)
    select request_id, preferred_time, support_mode::public.support_mode, 'Completed', preferred_time + interval '1 hour'
    from public.support_request where request_id = ('d3d3d3d3-00' || lpad(r.n::text, 2, '0') || '-4000-8000-0000000000' || lpad(r.n::text, 2, '0'))::uuid
    returning session_id into v_session;
    insert into public.feedback (session_id, volunteer_id, rating, comment)
    select v_session, q.volunteer_id, r.rating, r.comment from public.support_request q where q.request_id = ('d3d3d3d3-00' || lpad(r.n::text, 2, '0') || '-4000-8000-0000000000' || lpad(r.n::text, 2, '0'))::uuid;
  end loop;
  alter table public.session enable trigger session_guard_trg;
end $$;

-- Cleanup (run this to remove everything above):
--   delete from public.feedback where session_id in (select session_id from public.session where request_id::text like 'd3d3d3d3-%');
--   delete from public.session         where request_id::text like 'd3d3d3d3-%';
--   delete from public.support_request where request_id::text like 'd3d3d3d3-%';
--   delete from auth.users             where email like 'demo.%@helplive.edu.my';  -- also removes their profile, skills and availability
