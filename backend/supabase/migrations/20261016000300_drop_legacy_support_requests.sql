-- The application has completed its cutover to public.support_request.
-- Refuse to remove the legacy table unless every source row is preserved.
do $$
begin
  if to_regclass('public.support_request') is null then
    raise exception 'Target table public.support_request was not found.';
  end if;

  if to_regclass('public.support_requests') is null then
    raise exception 'Legacy table public.support_requests was not found.';
  end if;

  if exists (
    select 1
    from public.support_requests src
    left join public.support_request dst on dst.request_id = src.id
    where dst.request_id is null
       or dst.requester_id is distinct from src.requester_id
       or dst.volunteer_id is distinct from src.volunteer_id
       or dst.category is distinct from src.category
       or dst.title is distinct from src.title
       or dst.description is distinct from src.description
       or dst.preferred_time is distinct from (
         (src.requested_date + src.requested_time) at time zone 'Asia/Kuala_Lumpur'
       )
       or dst.requested_date is distinct from src.requested_date
       or dst.requested_time is distinct from src.requested_time
       or dst.support_mode is distinct from src.support_mode
       or dst.status::text is distinct from src.status
       or dst.created_at is distinct from src.created_at
       or dst.rating is distinct from src.rating
  ) then
    raise exception 'Legacy support_requests rows are missing or differ in support_request; table was not removed.';
  end if;
end
$$;

drop table public.support_requests;
