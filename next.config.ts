import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

// Point the plugin at the server-side request config (locale + messages resolver).
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// --- Content Security Policy (Report-Only for now) ---------------------------
// Shipped in report-only mode so violations are logged (browser console / Sentry
// once wired) WITHOUT breaking the app while the allowlist is tuned. Flip the
// header name to "Content-Security-Policy" to enforce once the report is clean.
//
// Allowlist rationale:
//   - Supabase REST/Storage/Auth (https) + Realtime (wss) → *.supabase.co
//   - Leaflet OpenStreetMap tiles → *.tile.openstreetmap.org (img)
//   - blob:/data: → OGL WebGL canvas, next/font, and the geo-proof preview
//     (URL.createObjectURL) in app/crew/crew-content.tsx
//   - 'unsafe-inline'/'unsafe-eval' on script-src are required by Next.js'
//     inline bootstrap + dev React refresh; tighten to nonces later if desired.
const cspReportOnly = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // 'self' (not 'none') so Next.js' dev overlay can frame the app same-origin;
  // still blocks cross-origin clickjacking (the real threat). The app has no iframes.
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.supabase.co",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-src 'self'",
]
  .join("; ")
  .concat(";");

const securityHeaders = [
  // Enforce HTTPS for 2 years (incl. subdomains). Only takes effect over HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Clickjacking protection (frame-ancestors 'self' in CSP is the modern twin).
  // SAMEORIGIN (not DENY) to match frame-ancestors 'self'; blocks cross-origin framing.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Stop MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Trim referrer leakage.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Only the features the app actually uses: crew proof capture needs camera +
  // geolocation (same-origin); everything else off.
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=()",
  },
  // Report-only CSP — see note above.
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
];

const nextConfig: NextConfig = {
  // Remove the framework-fingerprinting X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "amartya",
  project: "trashium",
  // Source-map upload token — set in .env.local / CI, never committed.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  // Same-origin proxy route for event ingestion (ad-blocker bypass);
  // already covered by connect-src 'self' in the CSP above.
  tunnelRoute: "/monitoring",
});
