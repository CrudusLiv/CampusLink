-- Track each assignment independently so reminders and reassignment are race safe.
alter table public.support_request
  add column if not exists volunteer_assigned_at timestamptz not null default now(),
  add column if not exists assignment_version integer not null default 1;

alter table public.notification
  add column if not exists request_id uuid references public.support_request(request_id) on delete set null;

-- Keep assignment age/version synchronized for requests created and edited through existing paths.
create or replace function public.track_support_request_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.volunteer_assigned_at := now();
    new.assignment_version := 1;
  elsif new.volunteer_id is distinct from old.volunteer_id then
    new.volunteer_assigned_at := now();
    new.assignment_version := old.assignment_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists support_request_assignment_tracking on public.support_request;
create trigger support_request_assignment_tracking
  before insert or update of volunteer_id on public.support_request
  for each row execute function public.track_support_request_assignment();

-- Atomic owner/status/old-assignee check. Row lock serializes against volunteer response.
create or replace function public.reassign_pending_support_request(
  p_request_id uuid,
  p_expected_volunteer_id uuid,
  p_new_volunteer_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.support_request%rowtype;
  v_caller uuid := (select auth.uid());
  v_volunteer public.volunteer_profile%rowtype;
begin
  if v_caller is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if p_new_volunteer_id is null or p_new_volunteer_id = p_expected_volunteer_id or p_new_volunteer_id = v_caller then
    raise exception 'INVALID_VOLUNTEER' using errcode = '22023';
  end if;

  select * into v_request from public.support_request
   where request_id = p_request_id for update;
  if not found or v_request.requester_id <> v_caller then
    raise exception 'REQUEST_NOT_OWNED' using errcode = '42501';
  end if;
  if v_request.status::text <> 'Pending' then
    raise exception 'REQUEST_NOT_PENDING' using errcode = 'P0001';
  end if;
  if v_request.volunteer_id is distinct from p_expected_volunteer_id then
    raise exception 'ASSIGNMENT_CHANGED' using errcode = 'P0001';
  end if;

  select * into v_volunteer from public.volunteer_profile
   where user_id = p_new_volunteer_id and is_volunteer = true;
  if not found or not (v_request.category = any(coalesce(v_volunteer.skills, array[]::text[]))) then
    raise exception 'VOLUNTEER_INELIGIBLE' using errcode = '23503';
  end if;

  update public.support_request set volunteer_id = p_new_volunteer_id
   where request_id = p_request_id;
  insert into public.notification (user_id, type, message, event_key, request_id)
  values (
    p_new_volunteer_id,
    'request_pending',
    'You received a new support request: "' || v_request.title || '".',
    'request:' || v_request.request_id::text || ':assignment:' || (v_request.assignment_version + 1)::text,
    v_request.request_id
  ) on conflict (event_key) where event_key is not null do nothing;
  return (select assignment_version from public.support_request where request_id = p_request_id);
end;
$$;

revoke all on function public.reassign_pending_support_request(uuid, uuid, uuid) from public, anon;
grant execute on function public.reassign_pending_support_request(uuid, uuid, uuid) to authenticated;

-- Scheduled, idempotent reminder generation. event_key includes assignment version.
create or replace function public.notify_unanswered_support_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notification (user_id, type, message, event_key, request_id)
  select r.requester_id,
         'request_no_response',
         'Your selected volunteer has not responded to your support request within 24 hours. You may choose another volunteer or continue waiting for the current volunteer.',
         'request:' || r.request_id::text || ':no-response:' || r.assignment_version::text,
         r.request_id
    from public.support_request r
   where r.status::text = 'Pending'
     and r.volunteer_id is not null
     and r.volunteer_assigned_at <= now() - interval '24 hours'
  on conflict (event_key) where event_key is not null do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.notify_unanswered_support_requests() from public, anon, authenticated;

-- Supabase hosted projects with pg_cron available schedule this database-side check hourly.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    if not exists (select 1 from cron.job where jobname = 'campuslink-support-no-response-reminders') then
      perform cron.schedule(
        'campuslink-support-no-response-reminders',
        '0 * * * *',
        'select public.notify_unanswered_support_requests()'
      );
    end if;
  end if;
exception when undefined_table then
  -- pg_cron is not fully installed/enabled; the deployment must schedule this function externally.
  raise notice 'pg_cron schema is unavailable; schedule public.notify_unanswered_support_requests() externally.';
end;
$$;
