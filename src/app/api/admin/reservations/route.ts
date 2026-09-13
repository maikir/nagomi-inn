import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";
import { authorizeAdmin } from "@/lib/server/admin";
import { parseImportUrls } from "@/lib/server/icalSync";

/**
 * GET /api/admin/reservations
 * Owner-only. Verifies the caller's token, checks their email against the
 * ADMIN_EMAILS allowlist, then returns ALL reservations plus OTA blocks using
 * the service role. RLS stays strict for everyone else — this is the only path
 * that sees every booking, and it's gated here on the server.
 */
export const dynamic = "force-dynamic";

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

  return NextResponse.json({
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
  });
}
