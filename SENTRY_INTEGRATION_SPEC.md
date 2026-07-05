# SENTRY INTEGRATION — SPEC / PROMPT FOR FABLE (VS Code, Sentry MCP connected)

> Paste the block below into the VS Code Claude Code extension ("Fable"). It has the Sentry MCP
> connected, so it can create the project and fetch the DSN itself. This wires `@sentry/nextjs` into
> Trashium (Next.js 16 / React 19) with a strict PII scrub, because this app handles household
> emails, addresses, and geo-proof coordinates that must NOT leak into an error tracker.
>
> After Fable finishes, the diff comes back here for review (per the normal workflow).

---

## PASTE THIS INTO FABLE

```
Integrate Sentry error monitoring into this Next.js 16 / React 19 project. Use the connected Sentry
MCP to create the project, then wire the SDK. Follow every constraint below exactly.

STEP 1 — Create the Sentry project (via the Sentry MCP)
- Use my existing Sentry org.
- Create a project named "trashium", platform "javascript-nextjs".
- Retrieve the DSN and the org/project slugs. Report them back to me; do NOT hardcode the DSN in code.

STEP 2 — Install + scaffold
- Add "@sentry/nextjs" (verify the version supports Next.js 16 App Router + Turbopack; if the latest
  stable does not, tell me before proceeding rather than downgrading Next).
- Prefer manual setup over the interactive wizard so nothing unexpected is changed. Create:
  - instrumentation-client.ts (or sentry.client.config.ts per the installed SDK version's convention)
  - sentry.server.config.ts
  - sentry.edge.config.ts
  - a Next instrumentation hook if the SDK version requires one.

STEP 3 — Config values (all three runtimes)
- Read the DSN from env: NEXT_PUBLIC_SENTRY_DSN (client) / SENTRY_DSN (server & edge). Never inline it.
- tracesSampleRate: 0.1
- DISABLE Session Replay entirely (do not add replayIntegration). This app renders addresses, emails,
  and map/geo data — Replay would capture that DOM. If you believe Replay is needed, ask me first;
  otherwise leave it off.
- environment: process.env.NODE_ENV
- Enable Sentry only when a DSN is present (guard: if (!DSN) skip init) so local dev without a DSN
  is unaffected.

STEP 4 — PII SCRUB (mandatory — beforeSend on client, server, AND edge)
Add a beforeSend that removes personally identifying / location data before any event is sent:
- Set sendDefaultPii: false.
- In beforeSend(event):
  - delete event.user?.email and event.user?.ip_address (keep only an opaque user id if present).
  - Recursively redact these keys anywhere in event.request, event.extra, event.contexts, and
    breadcrumb data: email, address, full_name, latitude, longitude, proof_latitude, proof_longitude,
    notes, pincode. Replace values with "[redacted]".
  - Scrub query strings / request bodies that may contain the above.
- Do the same scrub for breadcrumbs (beforeBreadcrumb) — Supabase/fetch breadcrumbs can carry query
  params with emails or coordinates.

STEP 5 — next.config.ts (IMPORTANT — do not clobber existing config)
The current next.config.ts already:
  - imports createNextIntlPlugin and exports `withNextIntl(nextConfig)`
  - sets poweredByHeader: false
  - defines an async headers() block (security headers, incl. a Content-Security-Policy-Report-Only)
Requirements:
  - COMPOSE the wrappers: export withSentryConfig(withNextIntl(nextConfig), {...}). Do not remove
    next-intl and do not drop poweredByHeader or the headers() block.
  - Set the Sentry build options: org/project slugs from Step 1, silent: !process.env.CI,
    widenClientFileUpload: true, disableLogger: true, tunnelRoute: "/monitoring".
  - Because tunnelRoute adds a same-origin route, the existing CSP connect-src ('self') already
    covers it — leave the CSP as-is (report-only). Just confirm you didn't change the headers.

STEP 6 — Env files
- .env.example already has commented NEXT_PUBLIC_SENTRY_DSN / SENTRY_DSN / SENTRY_AUTH_TOKEN
  placeholders — uncomment them (names only, no values).
- Add the real DSN to my local .env.local (gitignored). Put SENTRY_AUTH_TOKEN (for source-map upload)
  in .env.local too, never in git.

STEP 7 — Verify
- Run: npx tsc --noEmit && npm run lint  → must be 0 errors (42 pre-existing warnings are fine).
- Add a temporary throwaway test route/button that throws, trigger it, and confirm in Sentry that:
  (a) the event arrives, and (b) email/address/lat/lng do NOT appear anywhere in it. Then remove the
  test trigger.

HARD CONSTRAINTS (do not violate)
- Do NOT touch: /ml/**, lib/pricing*.ts, lib/estimate.ts, lib/estimator-types.ts, lib/waste-items.ts,
  the price_estimates table, or the pickup quote in schedule-pickup-modal.tsx.
- Do NOT enable/modify RLS or any database policy — DB security is a separate, later phase.
- Do NOT change the theme (app/globals.css) or add UI.
- No dependencies beyond @sentry/nextjs (+ its own transitive deps).
- Keep the server/client split; keep the app running.
Report back: the DSN + slugs, the list of files created/changed, and the tsc/lint result.
```

---

## What I'll check when your diff comes back
- `withSentryConfig(withNextIntl(...))` composition is correct and the security headers +
  `poweredByHeader:false` survived untouched.
- `beforeSend`/`beforeBreadcrumb` actually strip email/address/lat/lng/notes/pincode (the fields RLS
  protects) — I'll eyeball the scrub against a sample event.
- Session Replay is off; `sendDefaultPii: false`; DSN only from env, never inlined.
- `@sentry/nextjs` is Next 16-compatible; tsc/lint green.
```
