-- Support "Sign in with Microsoft" (HELP University accounts only)
--
-- Students who sign in with Microsoft never fill in the register form,
-- so the trigger now works out the missing details itself:
--   - student ID  -> taken from the email 
--   - name        -> from the Microsoft account, or the student ID if missing
--   - microsoft_oid -> the Microsoft account ID (matches the data dictionary)
-- Email + password sign-ups keep working exactly as before.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(new.email);
  v_meta  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_local text;
begin
  -- Server-side check: only HELP University emails can have an account
  if v_email is null or v_email not like '%@helplive.edu.my' then
    raise exception 'Only @helplive.edu.my email addresses can register';
  end if;

  v_local := split_part(v_email, '@', 1);

  insert into public.users (user_id, email, name, student_id, contact_no, microsoft_oid)
  values (
    new.id,
    v_email,
    -- register form sends full_name; Microsoft sends full_name / name
    coalesce(nullif(v_meta ->> 'full_name', ''), nullif(v_meta ->> 'name', ''), upper(v_local)),
    -- register form sends student_id; otherwise use the part before @
    upper(coalesce(nullif(v_meta ->> 'student_id', ''), v_local)),
    nullif(v_meta ->> 'phone', ''),
    case
      when new.raw_app_meta_data ->> 'provider' = 'azure'
        then coalesce(v_meta ->> 'provider_id', v_meta ->> 'sub')
    end
  );

  return new;
end;
$$;
