-- ─── NAGOMI INN — guest address (guest registry, 旅館業法) ─────────────────
-- Run AFTER 20260930230049_server_only_bookings.sql, and BEFORE deploying the code that uses
-- it (checkout inserts these columns). Legacy rows stay NULL.

alter table public.reservations add column if not exists country text
  check (country ~ '^[A-Z]{2}$');
alter table public.reservations add column if not exists postal_code text
  check (char_length(postal_code) <= 20);
alter table public.reservations add column if not exists address text
  check (char_length(address) <= 200);

comment on column public.reservations.country is 'Guest address: ISO 3166-1 alpha-2 country code.';
