-- ─── Raise max guests: 16 → 18 ───────────────────────────────────────────────
-- One-time migration for databases created before this change.
-- (schema.sql already says 18 for fresh installs; keep site.pricing.maxGuests
-- in src/config/site.ts in sync with this constraint.)

alter table public.reservations
  drop constraint if exists reservations_guests_check;

alter table public.reservations
  add constraint reservations_guests_check check (guests between 1 and 18);
