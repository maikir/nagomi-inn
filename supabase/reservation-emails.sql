-- Run after stripe-ical-migration.sql, before enabling reservation emails.
-- Contains guest data and immutable email payloads; service-role access only.
create table if not exists public.reservation_confirmation_emails (
  reservation_id text primary key references public.reservations(id) on delete cascade,
  payload jsonb not null,
  first_attempt_at timestamptz,
  sent_at timestamptz,
  resend_email_id text,
  created_at timestamptz not null default now()
);
alter table public.reservation_confirmation_emails enable row level security;
revoke all on public.reservation_confirmation_emails from anon, authenticated;
grant select, insert, update on public.reservation_confirmation_emails to service_role;
