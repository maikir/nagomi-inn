-- Run AFTER stripe-ical-migration.sql and reservation-emails.sql, before deploying.
alter table public.reservations add column if not exists cancellation_state text
  check (cancellation_state in ('processing', 'failed', 'completed'));

create table if not exists public.reservation_cancellations (
  reservation_id text primary key references public.reservations(id) on delete cascade,
  refund_yen integer not null check (refund_yen >= 0),
  refund_percent integer not null check (refund_percent in (0, 50, 100)),
  lang text not null check (lang in ('en', 'ja')),
  payment_intent_id text,
  stripe_refund_id text unique,
  refund_status text,
  first_attempt_at timestamptz,
  completed_at timestamptz,
  email_completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (refund_yen = 0 or payment_intent_id is not null)
);
alter table public.reservation_cancellations enable row level security;
revoke all on public.reservation_cancellations from anon, authenticated;
grant select, insert, update on public.reservation_cancellations to service_role;

create table if not exists public.reservation_cancellation_emails (
  reservation_id text primary key references public.reservations(id) on delete cascade,
  payload jsonb not null,
  first_attempt_at timestamptz,
  sent_at timestamptz,
  resend_email_id text,
  created_at timestamptz not null default now()
);
alter table public.reservation_cancellation_emails enable row level security;
revoke all on public.reservation_cancellation_emails from anon, authenticated;
grant select, insert, update on public.reservation_cancellation_emails to service_role;

-- Payment-enabled installations must cancel through the authenticated API.
-- A browser must not bypass refund verification by updating status directly.
drop policy if exists "cancel own reservations" on public.reservations;
revoke update on public.reservations from authenticated;
revoke update (status) on public.reservations from authenticated;

-- Atomically release the dates and mark the cancellation complete.
create or replace function public.complete_reservation_cancellation(p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.reservation_cancellations;
begin
  select * into c from public.reservation_cancellations where reservation_id = p_id for update;
  if not found then raise exception 'cancellation not found'; end if;
  if c.refund_yen > 0 and c.refund_status is distinct from 'succeeded' then
    raise exception 'refund has not succeeded';
  end if;
  if c.completed_at is not null then return; end if;
  update public.reservations set status = 'cancelled', cancellation_state = 'completed'
    where id = p_id and status in ('confirmed', 'cancelled');
  if not found then raise exception 'reservation is not cancellable'; end if;
  update public.reservation_cancellations set completed_at = now() where reservation_id = p_id;
end $$;
revoke all on function public.complete_reservation_cancellation(text) from public, anon, authenticated;
grant execute on function public.complete_reservation_cancellation(text) to service_role;
