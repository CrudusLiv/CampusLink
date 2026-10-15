-- Allow requesters to edit the fields on their own still-pending support requests.
-- The existing pending-to-cancelled policy continues to govern cancellation.
drop policy if exists "Users can edit their own pending support requests" on public.support_request;
create policy "Users can edit their own pending support requests"
  on public.support_request for update
  to authenticated
  using ((select auth.uid()) = requester_id and status = 'Pending')
  with check ((select auth.uid()) = requester_id and status = 'Pending');

grant update (title, description, category, requested_date, requested_time, preferred_time, support_mode, volunteer_id)
  on public.support_request to authenticated;
