-- ─── NAGOMI INN — stay plans + welcome email ────────────────────────────────
-- Run AFTER reservation-emails.sql and reservation-language.sql, and BEFORE
-- deploying the code that uses it (checkout inserts these columns).
--
-- Guests tell us at booking whether they plan to use the BBQ grill / barrel
-- sauna and roughly when they'll arrive, and acknowledge the Hotel Business
-- Act guest-registration notice. Values are fixed once booked.
-- Legacy rows stay NULL.

alter table public.reservations add column if not exists bbq_plan text
  check (bbq_plan in ('yes', 'no', 'undecided'));
alter table public.reservations add column if not exists sauna_plan text
  check (sauna_plan in ('yes', 'no', 'undecided'));
alter table public.reservations add column if not exists arrival_time text
  check (arrival_time in ('15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', 'late', 'undecided'));
alter table public.reservations add column if not exists registry_ack_at timestamptz;

comment on column public.reservations.registry_ack_at is
  'When the guest acknowledged the Hotel Business Act guest-registration notice (server time). Not a substitute for check-in verification.';

-- Welcome email from the hosts, sent right after the confirmation email.
-- Same outbox shape as the confirmation/cancellation email tables.
create table if not exists public.reservation_welcome_emails (
  reservation_id text primary key references public.reservations(id) on delete cascade,
  payload jsonb not null,
  first_attempt_at timestamptz,
  sent_at timestamptz,
  resend_email_id text,
  created_at timestamptz not null default now()
);
alter table public.reservation_welcome_emails enable row level security;
revoke all on public.reservation_welcome_emails from anon, authenticated;
grant select, insert, update on public.reservation_welcome_emails to service_role;
