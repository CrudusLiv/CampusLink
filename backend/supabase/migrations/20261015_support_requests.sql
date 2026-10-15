-- Extend the existing public.support_request table used by the project.
-- The table already owns request_id, preferred_time, and request_status; keep
-- those columns and add the fields the application needs.
alter table public.support_request
  add column if not exists title varchar,
  add column if not exists description text,
  add column if not exists support_mode text,
  add column if not exists requested_date date,
  add column if not exists requested_time time,
  add column if not exists created_at timestamptz not null default now();

-- Backfill the display date/time for rows that predate these application fields.
update public.support_request
set requested_date = (preferred_time at time zone 'UTC')::date
where requested_date is null;

update public.support_request
set requested_time = (preferred_time at time zone 'UTC')::time
where requested_time is null;

alter table public.support_request
  alter column title set not null,
  alter column description set not null,
  alter column category set not null,
  alter column preferred_time set not null,
  alter column requested_date set not null,
  alter column requested_time set not null;

create index if not exists support_request_requester_created_idx
  on public.support_request (requester_id, created_at desc);

alter table public.support_request enable row level security;

drop policy if exists "Users can view their own support requests" on public.support_request;
create policy "Users can view their own support requests"
  on public.support_request for select
  to authenticated
  using ((select auth.uid()) = requester_id);

drop policy if exists "Users can create their own support requests" on public.support_request;
create policy "Users can create their own support requests"
  on public.support_request for insert
  to authenticated
  with check ((select auth.uid()) = requester_id);

drop policy if exists "Users can cancel their own pending support requests" on public.support_request;
create policy "Users can cancel their own pending support requests"
  on public.support_request for update
  to authenticated
  using ((select auth.uid()) = requester_id and status = 'Pending')
  with check ((select auth.uid()) = requester_id and status = 'Cancelled');

revoke all on public.support_request from anon;
grant select, insert on public.support_request to authenticated;
grant update (status) on public.support_request to authenticated;

-- The volunteer dashboard supports declining an assigned request. Add the enum
-- value here so later migrations can safely use it.
alter type public.request_status add value if not exists 'Declined';
