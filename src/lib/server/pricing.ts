import { getSupabaseAdmin } from "./supabaseAdmin";
import { defaultPricing, mergePricing, type Pricing } from "@/lib/pricing";

/**
 * Server-side effective pricing: the owner's stored values from
 * pricing_settings merged over the defaults. Falls back to defaults when the
 * table/row is absent or Supabase isn't configured. Used by the checkout route
 * (authoritative charge) and the public /api/pricing route.
 */
export async function getEffectivePricing(): Promise<Pricing> {
  const admin = getSupabaseAdmin();
  if (!admin) return defaultPricing;
  try {
    const { data } = await admin.from("pricing_settings").select("*").eq("id", 1).maybeSingle();
    if (!data) return defaultPricing;
    return mergePricing({
      baseNightly: data.base_nightly as number,
      includedGuests: data.included_guests as number,
      perGuestNightly: data.per_guest_nightly as number,
      cleaningFee: data.cleaning_fee as number,
    });
  } catch {
    return defaultPricing;
  }
}
