/**
 * Owner allowlist — SERVER ONLY. An email is an admin if it appears in the
 * ADMIN_EMAILS env var (comma-separated). Checked inside the /api/admin route
 * before any data is returned; never trust a client-side admin flag.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
