-- ─── NAGOMI INN — Supabase schema (auth-enabled) ─────────────────────────────
-- Run this in the Supabase SQL editor (Database → SQL) of your project,
-- then set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in the app.
--
-- Model:
--  • Guests sign in (Google / Apple / email+password) to reserve.
--  • Each reservation belongs to a user (user_id = auth.uid()).
--  • RLS: users can only see and cancel their OWN reservations.
--  • Availability is public via the `booked_ranges` view, which exposes
--    ONLY dates — never names or contact details.
--  • Overlapping confirmed stays are impossible at the database level
--    (exclusion constraint → error 23P01, surfaced as "dates unavailable").

create extension if not exists btree_gist;

-- Human-friendly confirmation codes like NGM-7K2F9Q
create or replace function public.generate_confirmation_code() returns text as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code  text := '';
begin
  for i in 1..6 loop
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return 'NGM-' || code;
end;
$$ language plpgsql volatile;

create table if not exists public.reservations (
  id         text primary key default public.generate_confirmation_code(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  check_in   date not null,
  check_out  date not null,
  guests     int  not null check (guests between 1 and 16),
  name       text not null,
  email      text not null,
  phone      text,
  notes      text,
  total_yen  int  not null,
  status     text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),

  check (check_out > check_in),

  -- The whole property is a single unit: two confirmed stays can never overlap.
  constraint no_overlapping_stays exclude using gist (
    daterange(check_in, check_out) with &&
  ) where (status = 'confirmed')
);

alter table public.reservations enable row level security;

-- Guests manage only their own reservations.
create policy "insert own reservations"
  on public.reservations for insert to authenticated
  with check (user_id = auth.uid());

create policy "read own reservations"
  on public.reservations for select to authenticated
  using (user_id = auth.uid());

create policy "cancel own reservations"
  on public.reservations for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Public availability: dates only, no personal data. The view runs as its
-- owner (security definer semantics), which is what lets anon see the dates
-- while RLS keeps the base table private.
create or replace view public.booked_ranges as
  select check_in, check_out
  from public.reservations
  where status = 'confirmed';

-- Explicit grants (required if "automatically expose new tables" is off).
grant usage on schema public to anon, authenticated;
grant select, insert on public.reservations to authenticated;
grant update (status) on public.reservations to authenticated; -- cancel only
grant select on public.booked_ranges to anon, authenticated;

-- ── Owner access ─────────────────────────────────────────────────────────────
-- View / manage ALL bookings via the Supabase dashboard (Table Editor), which
-- uses the service role and bypasses RLS. For an in-app admin page later, add
-- an `is_admin` claim + policy — don't ship the service key to the browser.
