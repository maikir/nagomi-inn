import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { authorizeAdmin } from "@/lib/server/admin";
import { parseImportUrls } from "@/lib/server/icalSync";
import { isAmenityPlan, isArrivalTime } from "@/lib/reservations/stayPlans";

/**
 * GET /api/admin/reservations
 * Owner-only. Verifies the caller's token, checks their email against the
 * ADMIN_EMAILS allowlist, then returns ALL reservations plus OTA blocks using
 * the service role. RLS stays strict for everyone else — this is the only path
 * that sees every booking, and it's gated here on the server.
 */
// Owner data must always be live: opt this route AND the supabase-js fetches
// inside it out of Next's Data Cache, and tell any CDN/browser not to store it.
// (force-dynamic alone doesn't reliably stop the internal fetch from caching,
// which is what made /admin lag behind the direct-read customer pages.)
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

type Row = {
  id: string;
  check_in: string;
  check_out: string;
  guests: number;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  total_yen: number;
  bbq_plan: string | null;
  sauna_plan: string | null;
  arrival_time: string | null;
  coupon_code?: string | null;
  discount_yen?: number | null;
  status: "pending" | "confirmed" | "cancelled";
  created_at: string;
  paid_at: string | null;
};

export async function GET(req: Request) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 501 });

  const auth = await authorizeAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.status === 403 ? "FORBIDDEN" : "AUTH_REQUIRED" }, { status: auth.status });

  const { data: rows, error } = await admin
    .from("reservations")
    .select("*")
    .order("check_in", { ascending: true });
  if (error) return NextResponse.json({ error: "DB_ERROR" }, { status: 500 });

  // OTA blocks are optional (table only exists after the Stripe/iCal migration).
  const { data: blocks } = await admin
    .from("external_blocks")
    .select("source, check_in, check_out, summary");

  return NextResponse.json(
    {
      reservations: (rows as Row[]).map((r) => ({
        id: r.id,
        checkIn: r.check_in,
        checkOut: r.check_out,
        guests: r.guests,
        name: r.name,
        email: r.email,
        phone: r.phone ?? undefined,
        notes: r.notes ?? undefined,
        totalYen: r.total_yen,
        bbqPlan: isAmenityPlan(r.bbq_plan) ? r.bbq_plan : undefined,
        saunaPlan: isAmenityPlan(r.sauna_plan) ? r.sauna_plan : undefined,
        arrivalTime: isArrivalTime(r.arrival_time) ? r.arrival_time : undefined,
        couponCode: r.coupon_code ?? undefined,
        discountYen: r.discount_yen ?? undefined,
        status: r.status,
        createdAt: r.created_at,
        paidAt: r.paid_at ?? undefined,
      })),
      externalBlocks: (blocks ?? []).map((b) => ({
        source: b.source as string,
        checkIn: b.check_in as string,
        checkOut: b.check_out as string,
        summary: (b.summary as string | null) ?? undefined,
      })),
      // Whether any OTA calendars are connected — drives the "refresh" button.
      icalConfigured: parseImportUrls().length > 0,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
