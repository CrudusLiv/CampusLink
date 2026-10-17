-- Make public.feedback the only rating source for completed sessions.
-- Keep this guard so a future deployment cannot silently discard request ratings.
do $$
begin
  if exists (
    select 1 from public.support_request where rating is not null
  ) then
    raise exception 'support_request contains ratings that must be migrated before dropping the column';
  end if;
end
$$;

drop policy if exists "Requesters can rate completed support requests" on public.support_request;
alter table public.support_request drop column rating;

alter table public.feedback enable row level security;
alter table public.session enable row level security;

alter table public.feedback
  add constraint feedback_rating_range_check check (rating between 1 and 5);

create unique index if not exists feedback_one_per_session_uidx
  on public.feedback (session_id);

revoke all on public.feedback from anon, authenticated;
grant select on public.feedback to authenticated;
grant insert (session_id, volunteer_id, rating, comment) on public.feedback to authenticated;
grant update (rating, comment) on public.feedback to authenticated;
revoke all on public.session from anon;
grant select on public.session to authenticated;

drop policy if exists "Session participants can view sessions" on public.session;
create policy "Session participants can view sessions"
  on public.session for select
  to authenticated
  using (
    exists (
      select 1
      from public.support_request request
      where request.request_id = session.request_id
        and (select auth.uid()) in (request.requester_id, request.volunteer_id)
    )
  );

drop policy if exists "Session participants can view feedback" on public.feedback;
create policy "Session participants can view feedback"
  on public.feedback for select
  to authenticated
  using (
    exists (
      select 1
      from public.session session_row
      join public.support_request request on request.request_id = session_row.request_id
      where session_row.session_id = feedback.session_id
        and (select auth.uid()) in (request.requester_id, request.volunteer_id)
    )
  );

drop policy if exists "Requesters can submit feedback for completed sessions" on public.feedback;
create policy "Requesters can submit feedback for completed sessions"
  on public.feedback for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.session session_row
      join public.support_request request on request.request_id = session_row.request_id
      where session_row.session_id = feedback.session_id
        and session_row.status = 'Completed'
        and request.requester_id = (select auth.uid())
        and request.volunteer_id = feedback.volunteer_id
    )
  );

drop policy if exists "Requesters can edit feedback for completed sessions" on public.feedback;
create policy "Requesters can edit feedback for completed sessions"
  on public.feedback for update
  to authenticated
  using (
    exists (
      select 1
      from public.session session_row
      join public.support_request request on request.request_id = session_row.request_id
      where session_row.session_id = feedback.session_id
        and session_row.status = 'Completed'
        and request.requester_id = (select auth.uid())
        and request.volunteer_id = feedback.volunteer_id
    )
  )
  with check (
    exists (
      select 1
      from public.session session_row
      join public.support_request request on request.request_id = session_row.request_id
      where session_row.session_id = feedback.session_id
        and session_row.status = 'Completed'
        and request.requester_id = (select auth.uid())
        and request.volunteer_id = feedback.volunteer_id
    )
  );
