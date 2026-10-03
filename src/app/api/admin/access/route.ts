import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/server/admin";

export const dynamic = "force-dynamic";

/** Expose only the caller's access result, never the server-side allowlist. */
export async function GET(req: Request) {
  const auth = await authorizeAdmin(req);
  return NextResponse.json({ isAdmin: auth.ok }, {
    status: auth.ok ? 200 : auth.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
