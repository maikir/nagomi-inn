import { afterAll, beforeEach, expect, mock, test } from "bun:test";
let identity: { email: string } | null = null;
const originalAllowlist = process.env.ADMIN_EMAILS;
mock.module("../src/lib/server/supabaseAdmin", () => ({
  getSupabaseAsUser: () => ({ auth: { getUser: async () => ({ data: { user: identity } }) } }),
}));
const { GET } = await import("../src/app/api/admin/access/route");
beforeEach(() => { identity = null; process.env.ADMIN_EMAILS = " Owner@Example.com , second@example.com "; });
afterAll(() => { if (originalAllowlist === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = originalAllowlist; });
const request = () => new Request("http://localhost/api/admin/access", { headers: { Authorization: "Bearer test" } });
test("signed-out request is denied", async () => {
  expect((await GET(new Request("http://localhost/api/admin/access"))).status).toBe(401);
});
test("invalid session is denied", async () => {
  expect((await GET(request())).status).toBe(401);
});
test("ordinary signed-in user is denied", async () => {
  identity = { email: "guest@example.com" };
  const response = await GET(request());
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ isAdmin: false });
});
test("allowlisted owner gets only their access result and no shared cache", async () => {
  identity = { email: "owner@example.com" };
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ isAdmin: true });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
