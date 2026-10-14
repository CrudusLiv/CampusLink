-- 1. Row Level Security policies for volunteer_profile
--    (RLS is already enabled on this table but it had no policies,
--     so nobody could read or write it from the app.)

-- Any logged-in student can see volunteer profiles (needed for the
-- volunteer list and auto-matching in Epic 2)
drop policy if exists "Signed-in users can view volunteer profiles" on public.volunteer_profile;
create policy "Signed-in users can view volunteer profiles"
  on public.volunteer_profile for select
  to authenticated
  using (true);

-- A student can only create / change their OWN volunteer profile
drop policy if exists "Users can create their own volunteer profile" on public.volunteer_profile;
create policy "Users can create their own volunteer profile"
  on public.volunteer_profile for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own volunteer profile" on public.volunteer_profile;
create policy "Users can update their own volunteer profile"
  on public.volunteer_profile for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- 2. Row Level Security policies for availability

-- Any logged-in student can see availability (needed for filtering,
-- auto-matching and the session time picker in Epic 3)
drop policy if exists "Signed-in users can view availability" on public.availability;
create policy "Signed-in users can view availability"
  on public.availability for select
  to authenticated
  using (true);

-- A volunteer can only add / change / remove their OWN time slots
drop policy if exists "Users can add their own availability" on public.availability;
create policy "Users can add their own availability"
  on public.availability for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own availability" on public.availability;
create policy "Users can update their own availability"
  on public.availability for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own availability" on public.availability;
create policy "Users can delete their own availability"
  on public.availability for delete
  to authenticated
  using ((select auth.uid()) = user_id);


-- 3. Save skills and all time slots in ONE step (US2 task:
--    "Wrote Supabase database functions to save all picked time slots
--     at once"). Everything inside a function runs as one transaction,
--    so if any slot is invalid, nothing is saved.
--    p_slots example:
--    [{"day_of_week":"Mon","start_time":"10:00","end_time":"12:00"}]
create or replace function public.save_volunteer_setup(p_skills text[], p_slots jsonb)
returns void
language plpgsql
security invoker          -- runs as the logged-in user, so RLS still applies
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_slot jsonb;
begin
  if v_uid is null then
    raise exception 'You must be logged in to save your volunteer details';
  end if;

  -- Server-side validation (same rules as the form, US2 acceptance criteria)
  if p_skills is null or coalesce(array_length(p_skills, 1), 0) = 0 then
    raise exception 'Choose at least one subject tag';
  end if;

  if p_slots is null or jsonb_typeof(p_slots) <> 'array' or jsonb_array_length(p_slots) = 0 then
    raise exception 'Choose at least one time slot';
  end if;

  -- Create or update the volunteer profile
  insert into public.volunteer_profile (user_id, skills, is_volunteer)
  values (v_uid, p_skills, true)
  on conflict (user_id) do update
    set skills = excluded.skills,
        is_volunteer = true;

  -- Replace the old weekly schedule with the new one
  delete from public.availability where user_id = v_uid;

  for v_slot in select * from jsonb_array_elements(p_slots)
  loop
    if (v_slot ->> 'start_time')::time >= (v_slot ->> 'end_time')::time then
      raise exception 'Start time must be before end time';
    end if;

    insert into public.availability (user_id, day_of_week, start_time, end_time)
    values (
      v_uid,
      (v_slot ->> 'day_of_week')::public.day_of_week,
      (v_slot ->> 'start_time')::time,
      (v_slot ->> 'end_time')::time
    );
  end loop;
end;
$$;

revoke execute on function public.save_volunteer_setup(text[], jsonb) from public, anon;
grant execute on function public.save_volunteer_setup(text[], jsonb) to authenticated;
