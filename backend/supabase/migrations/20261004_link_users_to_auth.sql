-- 1. New profile fields needed by Epic 1 User Story 5 (faculty + bio)
alter table public.users
  add column if not exists faculty varchar(100),
  add column if not exists bio text;


-- 2. users.user_id must be the SAME id as the Supabase Auth account,
--    so it should not generate its own random id any more.
alter table public.users alter column user_id drop default;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_user_id_auth_fkey'
  ) then
    alter table public.users
      add constraint users_user_id_auth_fkey
      foreign key (user_id) references auth.users (id) on delete cascade;
  end if;
end $$;

-- One account per email and per student ID
create unique index if not exists users_email_unique on public.users (email);
create unique index if not exists users_student_id_unique on public.users (student_id);


-- 3. When someone signs up through Supabase Auth, automatically create
--    their row in public.users using the details from the register form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Server-side check: only HELP University emails can register
  if lower(new.email) not like '%@helplive.edu.my' then
    raise exception 'Only @helplive.edu.my email addresses can register';
  end if;

  insert into public.users (user_id, email, name, student_id, contact_no)
  values (
    new.id,
    lower(new.email),
    new.raw_user_meta_data ->> 'full_name',
    upper(new.raw_user_meta_data ->> 'student_id'),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 4. Row Level Security (NFR2)
alter table public.users enable row level security;

-- Logged-in students can see profiles (needed for volunteer lists, sessions)
drop policy if exists "Signed-in users can view profiles" on public.users;
create policy "Signed-in users can view profiles"
  on public.users for select
  to authenticated
  using (true);

-- Students can only update their OWN row
drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile"
  on public.users for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Students may only change these columns. Email, student ID and role stay
-- locked (User Story 5), so nobody can make themselves an admin.
revoke update on public.users from authenticated;
grant update (name, contact_no, photo_url, faculty, bio)
  on public.users to authenticated;
