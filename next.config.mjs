/**
 * Security headers for every page and API route.
 * No full Content-Security-Policy yet (Supabase, Stripe redirects and fonts
 * would each need allowlisting); `frame-ancestors` alone covers clickjacking.
 */
const securityHeaders = [
  // Nobody may embed our pages (booking form, admin panel) in a frame.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" }, // older browsers
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
