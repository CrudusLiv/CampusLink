-- Extend the established singular table, then merge every plural-table row into
-- it. This migration deliberately does not drop public.support_requests.
alter table public.support_request
  add column if not exists support_mode text,
  add column if not exists requested_date date,
  add column if not exists requested_time time,
  add column if not exists created_at timestamptz,
  add column if not exists rating smallint;

-- Populate display fields for existing singular-table rows using the agreed
-- campus timezone. preferred_time remains the canonical timestamp column.
update public.support_request
set requested_date = (preferred_time at time zone 'Asia/Kuala_Lumpur')::date
where requested_date is null;

update public.support_request
set requested_time = (preferred_time at time zone 'Asia/Kuala_Lumpur')::time
where requested_time is null;

alter table public.support_request
  alter column requested_date set not null,
  alter column requested_time set not null;

do $$
begin
  if to_regclass('public.support_requests') is null then
    raise exception 'Expected source table public.support_requests was not found; no rows were copied.';
  end if;

  if exists (
    select 1
    from public.support_requests src
    where not exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
        and t.typname = 'request_status'
        and e.enumlabel = src.status
    )
  ) then
    raise exception 'A source status has no matching public.request_status label; no rows were copied.';
  end if;

  if exists (
    select 1
    from public.support_requests src
    join public.support_request dst on dst.request_id = src.id
    where dst.requester_id is distinct from src.requester_id
       or dst.volunteer_id is distinct from src.volunteer_id
       or dst.category is distinct from src.category
       or dst.title is distinct from src.title
       or dst.description is distinct from src.description
       or dst.preferred_time is distinct from ((src.requested_date + src.requested_time) at time zone 'Asia/Kuala_Lumpur')
       or dst.requested_date is distinct from src.requested_date
       or dst.requested_time is distinct from src.requested_time
       or dst.status::text is distinct from src.status
       or (dst.support_mode is not null and dst.support_mode is distinct from src.support_mode)
       or (dst.created_at is not null and dst.created_at is distinct from src.created_at)
       or (dst.rating is not null and dst.rating is distinct from src.rating)
  ) then
    raise exception 'Conflicting request_id values exist between the tables; no rows were copied.';
  end if;

  insert into public.support_request as dst (
    request_id, requester_id, volunteer_id, category, title, description,
    preferred_time, requested_date, requested_time, support_mode, status,
    created_at, rating
  )
  select
    src.id, src.requester_id, src.volunteer_id, src.category, src.title,
    src.description,
    (src.requested_date + src.requested_time) at time zone 'Asia/Kuala_Lumpur',
    src.requested_date, src.requested_time, src.support_mode,
    src.status::public.request_status, src.created_at, src.rating
  from public.support_requests src
  on conflict (request_id) do update
    set support_mode = coalesce(dst.support_mode, excluded.support_mode),
        created_at = coalesce(dst.created_at, excluded.created_at),
        rating = coalesce(dst.rating, excluded.rating);
end
$$;

-- Older singular-table rows have no source creation date. Fill only rows that
-- remained unmatched after the data copy, then enforce the application default.
update public.support_request
set created_at = now()
where created_at is null;

alter table public.support_request
  alter column created_at set default now(),
  alter column created_at set not null;

create index if not exists support_request_requester_created_idx
  on public.support_request (requester_id, created_at desc);
create index if not exists support_request_volunteer_date_idx
  on public.support_request (volunteer_id, requested_date);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_request_rating_range_check'
      and conrelid = 'public.support_request'::regclass
  ) then
    alter table public.support_request
      add constraint support_request_rating_range_check
      check (rating is null or rating between 1 and 5);
  end if;
end
$$;

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

drop policy if exists "Users can edit their own pending support requests" on public.support_request;
create policy "Users can edit their own pending support requests"
  on public.support_request for update
  to authenticated
  using ((select auth.uid()) = requester_id and status = 'Pending')
  with check ((select auth.uid()) = requester_id and status = 'Pending');

drop policy if exists "Volunteers can view assigned support requests" on public.support_request;
create policy "Volunteers can view assigned support requests"
  on public.support_request for select
  to authenticated
  using ((select auth.uid()) = volunteer_id);

drop policy if exists "Volunteers can respond to assigned requests" on public.support_request;
create policy "Volunteers can respond to assigned requests"
  on public.support_request for update
  to authenticated
  using ((select auth.uid()) = volunteer_id and status = 'Pending')
  with check ((select auth.uid()) = volunteer_id and status in ('Accepted', 'Declined'));

drop policy if exists "Requesters can rate completed support requests" on public.support_request;
create policy "Requesters can rate completed support requests"
  on public.support_request for update
  to authenticated
  using ((select auth.uid()) = requester_id and status = 'Completed')
  with check ((select auth.uid()) = requester_id and status = 'Completed');

revoke all on public.support_request from anon;
revoke all on public.support_request from authenticated;
grant select, insert on public.support_request to authenticated;
grant update (status, title, description, category, requested_date, requested_time, preferred_time, support_mode, volunteer_id, rating)
  on public.support_request to authenticated;
