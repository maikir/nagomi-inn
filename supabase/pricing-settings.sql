-- ─── NAGOMI INN — owner-editable pricing ─────────────────────────────────────
-- Run in the Supabase SQL editor. Stores the pricing the owner can change from
-- the admin dashboard. A single row (id = 1). Publicly readable (pricing isn't
-- secret; the reserve page and checkout both read it); updates go only through
-- the admin service-role route, so there is no anon/authenticated UPDATE policy.

create table if not exists public.pricing_settings (
  id                int primary key default 1,
  base_nightly      int not null,
  included_guests   int not null,
  per_guest_nightly int not null,
  cleaning_fee      int not null default 0,
  updated_at        timestamptz not null default now(),
  constraint pricing_singleton check (id = 1),
  check (base_nightly >= 0 and per_guest_nightly >= 0 and cleaning_fee >= 0),
  check (included_guests between 1 and 18)
);

-- Seed with the current defaults (¥80,000 base, 8 guests included, ¥5,000/extra).
insert into public.pricing_settings (id, base_nightly, included_guests, per_guest_nightly, cleaning_fee)
values (1, 80000, 8, 5000, 0)
on conflict (id) do nothing;

alter table public.pricing_settings enable row level security;

create policy "public can read pricing"
  on public.pricing_settings for select to anon, authenticated using (true);

grant select on public.pricing_settings to anon, authenticated;
