-- FR18: a volunteer's average rating and recent feedback on their public profile.
-- Feedback rows can only be read by the two people in the session, so the public profile asks this
-- function instead. It returns only the average, the number of ratings and up to five recent comments
-- (rating and comment text, never names), and only to signed-in users.
create or replace function public.volunteer_rating_summary(p_volunteer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'average', (select round(avg(f.rating)::numeric, 1) from public.feedback f where f.volunteer_id = p_volunteer_id),
    'count', (select count(*) from public.feedback f where f.volunteer_id = p_volunteer_id),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('rating', r.rating, 'comment', r.comment) order by r.scheduled_datetime desc)
      from (
        select f.rating, f.comment, s.scheduled_datetime
        from public.feedback f
        join public.session s on s.session_id = f.session_id
        where f.volunteer_id = p_volunteer_id and btrim(coalesce(f.comment, '')) <> ''
        order by s.scheduled_datetime desc
        limit 5
      ) r
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.volunteer_rating_summary(uuid) from public, anon;
grant execute on function public.volunteer_rating_summary(uuid) to authenticated;
