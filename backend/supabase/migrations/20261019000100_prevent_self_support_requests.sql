-- Browser clients write support requests through Supabase PostgREST, so enforce
-- this rule in PostgreSQL as well as in the UI and request route. NOT VALID
-- preserves any historical rows while enforcing the rule on new/changed rows.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'support_request_no_self_volunteer'
      and conrelid = 'public.support_request'::regclass
  ) then
    alter table public.support_request
      add constraint support_request_no_self_volunteer
      check (requester_id is distinct from volunteer_id)
      not valid;
  end if;
end
$$;
