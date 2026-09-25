-- ─── NAGOMI INN — coupon codes ─────────────────────────────────────────────
-- Run AFTER stay-plans.sql, and BEFORE deploying the code that uses it
-- (checkout records these columns when a coupon is used).
--
-- Coupons themselves live in Stripe (promotion codes). We only record which
-- code a booking used and how much it took off. total_yen stays the amount
-- actually charged, which the webhook and refunds check against Stripe.

alter table public.reservations add column if not exists coupon_code text;
alter table public.reservations add column if not exists discount_yen integer
  check (discount_yen >= 0);
