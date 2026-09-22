-- Run before deploying reservation-language persistence.
-- Keep legacy rows NULL: defaulting them to English would hide the original
-- Japanese preference still available in their Stripe Checkout metadata.
alter table public.reservations add column if not exists lang text
  check (lang in ('en', 'ja'));

comment on column public.reservations.lang is
  'Booking language used by confirmation and cancellation emails. NULL for legacy bookings until recovered from Stripe.';
