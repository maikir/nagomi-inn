-- ─── NAGOMI INN — Stripe payments + OTA iCal sync migration ──────────────────
-- Run AFTER schema.sql, at the moment you enable payments
-- (NEXT_PUBLIC_PAYMENTS=stripe). From then on, guests can no longer create
-- reservations directly — every booking goes through Stripe Checkout:
--   client → /api/checkout → 'pending' hold → Stripe → webhook → 'confirmed'.

-- 1 ── reservation lifecycle: pending → confirmed | cancelled ────────────────
alter table public.reservations drop constraint if exists reservations_status_check;
alter table public.reservations
  add constraint reservations_status_check check (status in ('pending', 'confirmed', 'cancelled'));

-- Pending holds occupy dates too (no double-sell while a guest is paying).
alter table public.reservations drop constraint if exists no_overlapping_stays;
alter table public.reservations
  add constraint no_overlapping_stays exclude using gist (
    daterange(check_in, check_out) with &&
  ) where (status in ('pending', 'confirmed'));

alter table public.reservations add column if not exists stripe_session_id text;
alter table public.reservations add column if not exists paid_at timestamptz;

-- Clients may only create *pending* reservations now (payment confirms them
-- via the webhook, which uses the service role).
drop policy if exists "insert own reservations" on public.reservations;
create policy "insert own pending reservations"
  on public.reservations for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- 2 ── external calendars (Airbnb / Booking.com imports) ─────────────────────
create table if not exists public.external_blocks (
  id        bigint generated always as identity primary key,
  source    text not null,             -- 'airbnb', 'booking', …
  uid       text not null,             -- iCal event UID from the feed
  check_in  date not null,
  check_out date not null,             -- exclusive, like reservations
  summary   text,
  synced_at timestamptz not null default now(),
  unique (source, uid),
  check (check_out > check_in)
);
-- Service-role only (no policies): written by the sync job, never by browsers.
alter table public.external_blocks enable row level security;

create table if not exists public.ical_sync_state (
  source    text primary key,
  synced_at timestamptz not null default now(),
  events    int not null default 0
);
alter table public.ical_sync_state enable row level security;

-- New direct bookings must not overlap an OTA booking. (The reverse — an OTA
-- import overlapping an existing direct booking — is recorded as-is: it means
-- a double-booking already happened on the OTA side and needs human handling.)
create or replace function public.reject_external_overlap() returns trigger as $$
begin
  if new.status in ('pending', 'confirmed') and exists (
    select 1 from public.external_blocks b
    where daterange(b.check_in, b.check_out) && daterange(new.check_in, new.check_out)
  ) then
    raise exception 'dates blocked by external calendar' using errcode = '23P01';
  end if;
  return new;
end $$ language plpgsql security definer;

drop trigger if exists reservations_external_overlap on public.reservations;
create trigger reservations_external_overlap
  before insert or update on public.reservations
  for each row execute function public.reject_external_overlap();

-- 3 ── public availability now includes pending holds and OTA blocks ─────────
create or replace view public.booked_ranges as
  select check_in, check_out from public.reservations
  where status in ('pending', 'confirmed')
  union all
  select check_in, check_out from public.external_blocks;

grant select on public.booked_ranges to anon, authenticated;
