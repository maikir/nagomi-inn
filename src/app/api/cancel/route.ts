import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin, getSupabaseAsUser } from "@/lib/server/supabaseAdmin";
import { requestCancellation } from "@/lib/server/cancellation";

/** Requests cancellation; only a successful refund (or no refund due) completes it. */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = getSupabaseAdmin();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!admin || !stripeKey) {
    return NextResponse.json({ error: "PAYMENTS_NOT_CONFIGURED" }, { status: 501 });
  }

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const supabase = getSupabaseAsUser(token);
  const user = supabase ? (await supabase.auth.getUser(token)).data.user : null;
  if (!supabase || !user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const { id, lang } = (await req.json().catch(() => ({}))) as { id?: string; lang?: string };
  if (typeof id !== "string" || !id) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  // RLS: this query only finds the reservation if it belongs to the caller.
  const { data: reservation } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
  if (!reservation) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (reservation.status !== "confirmed" && reservation.status !== "cancelled") {
    return NextResponse.json({ error: "NOT_CANCELLABLE" }, { status: 400 });
  }

  try {
    const result = await requestCancellation(admin, new Stripe(stripeKey), reservation, lang);
    return NextResponse.json(result, { status: result.refundFailed ? 409 : result.pending ? 202 : 200 });
  } catch (error) {
    console.error("cancellation failed:", id, error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "CANCELLATION_FAILED" }, { status: 502 });
  }
}
