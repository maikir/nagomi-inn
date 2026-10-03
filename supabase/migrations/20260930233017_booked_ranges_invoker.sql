-- ─── NAGOMI INN — booked_ranges without a SECURITY DEFINER view ──────────────
-- Clears Supabase's "Security Definer View" lint on public.booked_ranges.
-- Run any time AFTER 20260720172646_stripe_payments_and_ical.sql. No app deploy needed: the view
-- keeps its name and columns (check_in, check_out), so the site is unaffected.
--
-- Why the view needed elevated rights at all: visitors must see which dates
-- are taken, but RLS (rightly) hides every reservation row from them. Before,
-- the view itself ran as its owner to get past RLS. Now that elevation lives in
-- one small function that can only ever return dates, in a schema the API
-- doesn't expose (so it can't be called directly), and the view runs with the
-- visitor's own permissions (security_invoker).

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.booked_date_ranges()
returns table (check_in date, check_out date)
language sql stable security definer
set search_path = ''
as $$
  select r.check_in, r.check_out from public.reservations r
  where r.status in ('pending', 'confirmed')
  union all
  select b.check_in, b.check_out from public.external_blocks b;
$$;
revoke all on function private.booked_date_ranges() from public;
grant execute on function private.booked_date_ranges() to anon, authenticated;

create or replace view public.booked_ranges
  with (security_invoker = on)
  as select check_in, check_out from private.booked_date_ranges();
grant select on public.booked_ranges to anon, authenticated;

-- Related lint ("Function Search Path Mutable"): pin the other functions too.
alter function public.reject_external_overlap() set search_path = public;
alter function public.generate_confirmation_code() set search_path = public;
