-- Add the application status labels in a standalone migration. PostgreSQL
-- requires new enum labels to be committed before a later migration uses them.
alter type public.request_status add value if not exists 'Pending';
alter type public.request_status add value if not exists 'Accepted';
alter type public.request_status add value if not exists 'Completed';
alter type public.request_status add value if not exists 'Cancelled';
alter type public.request_status add value if not exists 'Declined';
