-- Return only the accepted start times required for a student's schedule hint.
create or replace function public.get_volunteer_accepted_times(
  p_volunteer_id uuid,
  p_requested_date date
)
returns table (requested_time time without time zone)
language sql
stable
security definer
set search_path = public
as $$
  select sr.requested_time
  from public.support_request as sr
  where auth.uid() is not null
    and sr.volunteer_id = p_volunteer_id
    and sr.requested_date = p_requested_date
    and sr.status = 'Accepted';
$$;

revoke all on function public.get_volunteer_accepted_times(uuid, date) from public;
revoke all on function public.get_volunteer_accepted_times(uuid, date) from anon;
grant execute on function public.get_volunteer_accepted_times(uuid, date) to authenticated;
