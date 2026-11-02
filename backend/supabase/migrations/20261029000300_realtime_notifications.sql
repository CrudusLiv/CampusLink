-- Unified account-level notifications for support request state transitions.
-- The notification table predates migrations in production; keep this additive
-- and compatible with databases where it was created manually.
alter table public.notification
  add column if not exists event_key text;

create unique index if not exists notification_event_key_uidx
  on public.notification (event_key)
  where event_key is not null;

-- Browser clients can only see their own rows and change the read marker.
alter table public.notification enable row level security;
revoke all on public.notification from anon, authenticated;
grant select on public.notification to authenticated;
grant update (read_status) on public.notification to authenticated;

drop policy if exists "Users read own notifications" on public.notification;
create policy "Users read own notifications"
  on public.notification for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users mark own notifications read" on public.notification;
create policy "Users mark own notifications read"
  on public.notification for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.notify_support_request_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_type text;
  v_message text;
  v_event_key text;
begin
  if tg_op = 'INSERT' then
    if new.status::text <> 'Pending' or new.volunteer_id is null then
      return new;
    end if;
    v_recipient := new.volunteer_id;
    v_type := 'request_pending';
    v_message := 'You received a new support request: "' || new.title || '".';
    v_event_key := 'request:' || new.request_id::text || ':pending';
  elsif old.status::text = 'Pending' and new.status::text in ('Accepted', 'Declined', 'Cancelled') then
    if old.status is not distinct from new.status then
      return new;
    end if;
    v_recipient := new.requester_id;
    v_type := case new.status::text
      when 'Accepted' then 'request_accepted'
      when 'Declined' then 'request_declined'
      else 'request_cancelled'
    end;
    v_message := case new.status::text
      when 'Accepted' then 'Your support request was accepted: "' || new.title || '".'
      when 'Declined' then 'Your support request was declined: "' || new.title || '".'
      else 'A support request was cancelled: "' || new.title || '".'
    end;
    v_event_key := 'request:' || new.request_id::text || ':' || lower(new.status::text);
    -- Pending cancellations go to the assigned volunteer, not the requester.
    if new.status::text = 'Cancelled' then
      v_recipient := new.volunteer_id;
    end if;
  else
    return new;
  end if;

  if v_recipient is not null then
    insert into public.notification (user_id, type, message, event_key)
    values (v_recipient, v_type, v_message, v_event_key)
    on conflict (event_key) where event_key is not null do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.notify_support_request_transition() from public, anon, authenticated;

drop trigger if exists support_request_notification_transition on public.support_request;
create trigger support_request_notification_transition
  after insert or update of status on public.support_request
  for each row execute function public.notify_support_request_transition();

-- Realtime broadcasts INSERTs only; RLS still governs the authenticated subscriber.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notification'
     ) then
    alter publication supabase_realtime add table public.notification;
  end if;
end;
$$;
