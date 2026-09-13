import { getSupabaseAsUser } from "./supabaseAdmin";

/**
 * Owner allowlist — SERVER ONLY. An email is an admin if it appears in the
 * ADMIN_EMAILS env var (comma-separated). Checked inside the /api/admin routes
 * before anything privileged happens; never trust a client-side admin flag.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Verify a request carries a logged-in allowlisted owner. Shared gate for every
 * /api/admin/* route: returns the email on success, or a status to return.
 */
export async function authorizeAdmin(
  req: Request,
): Promise<{ ok: true; email: string } | { ok: false; status: 401 | 403 }> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401 };
  const asUser = getSupabaseAsUser(token);
  const user = asUser ? (await asUser.auth.getUser(token)).data.user : null;
  if (!user) return { ok: false, status: 401 };
  if (!isAdminEmail(user.email)) return { ok: false, status: 403 };
  return { ok: true, email: user.email! };
}
