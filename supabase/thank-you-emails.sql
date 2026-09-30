-- ─── NAGOMI INN — post-stay thank-you emails ────────────────────────────────
-- Run AFTER reservation-emails.sql, BEFORE deploying the code that uses it
-- (the daily job reads and writes this table).
-- Same outbox shape as the other reservation email tables.

create table if not exists public.reservation_thankyou_emails (
  reservation_id text primary key references public.reservations(id) on delete cascade,
  payload jsonb not null,
  first_attempt_at timestamptz,
  sent_at timestamptz,
  resend_email_id text,
  created_at timestamptz not null default now()
);
alter table public.reservation_thankyou_emails enable row level security;
revoke all on public.reservation_thankyou_emails from anon, authenticated;
grant select, insert, update on public.reservation_thankyou_emails to service_role;
