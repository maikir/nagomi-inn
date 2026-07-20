import { NextResponse } from "next/server";
import { buildIcs } from "@/lib/server/ical";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { site } from "@/config/site";

/**
 * GET /api/calendar.ics?token=ICAL_EXPORT_TOKEN
 * The feed you paste into Airbnb / Booking.com ("Import calendar").
 * Exports ONLY direct website bookings (confirmed + pending holds) as
 * all-day busy events — dates only, never guest details. OTA-imported
 * blocks are intentionally excluded to avoid echo loops.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = getSupabaseAdmin();
  const expected = process.env.ICAL_EXPORT_TOKEN;
  if (!admin || !expected) {
    return NextResponse.json({ error: "not configured" }, { status: 501 });
  }
  const token = new URL(req.url).searchParams.get("token");
  if (token !== expected) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Include recent history so OTAs don't "free" a just-departed stay early.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await admin
    .from("reservations")
    .select("id, check_in, check_out, status")
    .in("status", ["confirmed", "pending"])
    .gte("check_out", since)
    .order("check_in", { ascending: true });
  if (error) return NextResponse.json({ error: "db error" }, { status: 500 });

  const ics = buildIcs(
    (data ?? []).map((r) => ({
      uid: `${r.id}@nagomi-inn`,
      start: r.check_in as string,
      end: r.check_out as string,
      summary: "Nagomi Inn — Reserved (direct)",
    })),
    `${site.fullName} availability`,
  );

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="nagomi-inn.ics"',
      "Cache-Control": "no-store",
    },
  });
}
