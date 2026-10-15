-- Let volunteers read requests assigned to them for their dashboard.
drop policy if exists "Volunteers can view assigned support requests" on public.support_request;
create policy "Volunteers can view assigned support requests"
  on public.support_request for select
  to authenticated
  using ((select auth.uid()) = volunteer_id);

-- Volunteers may accept or decline a request assigned to them while it is pending.

drop policy if exists "Volunteers can respond to assigned requests" on public.support_request;
create policy "Volunteers can respond to assigned requests"
  on public.support_request for update
  to authenticated
  using ((select auth.uid()) = volunteer_id and status = 'Pending')
  with check ((select auth.uid()) = volunteer_id and status in ('Accepted', 'Declined'));

-- Store the requester's 1–5 feedback score for volunteer rating metrics.
alter table public.support_request
  add column if not exists rating smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'support_request_rating_range_check'
  ) then
    alter table public.support_request
      add constraint support_request_rating_range_check
      check (rating is null or rating between 1 and 5);
  end if;
end $$;

drop policy if exists "Requesters can rate completed support requests" on public.support_request;
create policy "Requesters can rate completed support requests"
  on public.support_request for update
  to authenticated
  using ((select auth.uid()) = requester_id and status = 'Completed')
  with check ((select auth.uid()) = requester_id and status = 'Completed');

grant update (rating) on public.support_request to authenticated;

create index if not exists support_request_volunteer_date_idx
  on public.support_request (volunteer_id, requested_date);
