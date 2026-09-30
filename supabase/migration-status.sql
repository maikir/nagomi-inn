-- ─── NAGOMI INN — which migrations has this database had? (read-only) ──────
-- Paste into the Supabase SQL editor and run. Nothing is changed.
--
-- The migrations were applied by hand, so there's no history table: instead,
-- each row looks for something that migration created. Run every ✗ migration
-- from supabase/migrations/, in filename order, top to bottom.
-- Never re-run a ✓ one — the early ones would undo later security fixes.

with reservation_columns as (
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'reservations'
)
select migration,
       case when applied then '✓ applied' else '✗ not applied' end as status
from (values
  (1,  '20260705222859_initial_schema',
       to_regclass('public.reservations') is not null),
  (2,  '20260720172646_stripe_payments_and_ical',
       to_regclass('public.external_blocks') is not null),
  -- Databases created after August already have the 18-guest limit.
  (3,  '20260811165802_max_guests_18',
       exists (select 1 from pg_constraint where conname = 'reservations_guests_check'
               and pg_get_constraintdef(oid) like '%18%')),
  (4,  '20260916213031_pricing_settings',
       to_regclass('public.pricing_settings') is not null),
  (5,  '20260922185305_reservation_emails',
       to_regclass('public.reservation_confirmation_emails') is not null),
  (6,  '20260922192919_cancellation_emails',
       to_regclass('public.reservation_cancellations') is not null),
  (7,  '20260922193721_reservation_language',
       exists (select 1 from reservation_columns where column_name = 'lang')),
  (8,  '20260925204339_stay_plans',
       to_regclass('public.reservation_welcome_emails') is not null),
  (9,  '20260925225302_coupons',
       exists (select 1 from reservation_columns where column_name = 'coupon_code')),
  (10, '20260930230049_server_only_bookings',
       case when to_regclass('public.reservations') is null then false
            else not has_table_privilege('authenticated', 'public.reservations', 'INSERT') end),
  (11, '20260930231754_guest_address',
       exists (select 1 from reservation_columns where column_name = 'address')),
  (12, '20260930232610_thank_you_emails',
       to_regclass('public.reservation_thankyou_emails') is not null),
  (13, '20260930233017_booked_ranges_invoker',
       to_regprocedure('private.booked_date_ranges()') is not null)
) as m(n, migration, applied)
order by n;
