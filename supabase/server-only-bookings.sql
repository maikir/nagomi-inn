-- ─── NAGOMI INN — reservations are created by the server only ───────────────
-- Run AFTER stripe-ical-migration.sql. Safe to run before or after deploying
-- the code that goes with it (checkout already inserts with the service role).
--
-- Previously a signed-in guest could insert 'pending' rows straight through the
-- Supabase API, bypassing /api/checkout. Those rows had no Stripe session, so
-- nothing ever released them: anyone with an account could block the calendar
-- (and the Airbnb feed) indefinitely, with any price or fields they liked.
-- Now /api/checkout verifies the guest and inserts with the service role.
-- Note: this ends the no-payments Supabase mode (browser-side inserts); with
-- Supabase connected, bookings go through Stripe Checkout.

drop policy if exists "insert own pending reservations" on public.reservations;
drop policy if exists "insert own reservations" on public.reservations;
revoke insert on public.reservations from anon, authenticated;

-- Release holds created the old way that never got a Checkout session.
update public.reservations
  set status = 'cancelled'
  where status = 'pending' and stripe_session_id is null
    and created_at < now() - interval '1 hour';
