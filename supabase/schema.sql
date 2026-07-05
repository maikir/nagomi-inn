-- ─── NAGOMI INN — Supabase schema ────────────────────────────────────────────
-- Run this in the Supabase SQL editor (Database → SQL) of a new project,
-- then set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in the app.

create extension if not exists btree_gist;

-- Human-friendly confirmation codes like NGM-7K2F9Q
create or replace function generate_confirmation_code() returns text as $$
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

create table if not exists reservations (
  id         text primary key default generate_confirmation_code(),
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
  -- Postgres enforces this at the database level (error code 23P01 on conflict,
  -- which the app surfaces as "dates unavailable").
  constraint no_overlapping_stays exclude using gist (
    daterange(check_in, check_out) with &&
  ) where (status = 'confirmed')
);

alter table reservations enable row level security;

-- Demo-grade policies: anyone with the anon key can create and read reservations.
-- Before real launch, tighten these (e.g. move writes behind an authenticated
-- server route or Supabase Edge Function, and restrict reads to the owner).
create policy "public can create reservations"
  on reservations for insert to anon with check (true);

create policy "public can read reservations"
  on reservations for select to anon using (true);

create policy "public can cancel reservations"
  on reservations for update to anon using (true) with check (status in ('confirmed', 'cancelled'));
