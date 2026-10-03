import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { authorizeAdmin } from "@/lib/server/admin";
import { getEffectivePricing } from "@/lib/server/pricing";
import { sanitizeEditablePricing } from "@/lib/pricing";

/**
 * GET  /api/admin/pricing — current editable pricing (owner only).
 * POST /api/admin/pricing — update it (owner only). Values are validated
 * server-side; the reserve page and checkout read the new figures immediately.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: auth.status });
  const pricing = await getEffectivePricing();
  return NextResponse.json(pricing, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "FORBIDDEN" }, { status: auth.status });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 501 });

  const clean = sanitizeEditablePricing(await req.json().catch(() => null));
  if (!clean) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const { error } = await admin.from("pricing_settings").upsert({
    id: 1,
    base_nightly: clean.baseNightly,
    included_guests: clean.includedGuests,
    per_guest_nightly: clean.perGuestNightly,
    cleaning_fee: clean.cleaningFee,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("pricing update failed:", error);
    return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });
  }

  return NextResponse.json(await getEffectivePricing(), { headers: { "Cache-Control": "no-store" } });
}
