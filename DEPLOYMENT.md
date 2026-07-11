# Deployment

This guide covers deploying Trashium to Vercel with a Supabase backend and an optional custom domain.

## 1. Prerequisites

- A GitHub repository containing this project.
- A Supabase project (the database schema in `supabase_schema.sql` already applied).
- A Vercel account.
- (Optional) A Sentry account for error monitoring.

## 2. Push to GitHub

```bash
git add -A
git commit -m "Prepare for deployment"
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin master
```

The `.gitignore` already excludes `.env.local`, the local `_archive/` folder, backups, and build output, so no secrets or scratch files are pushed.

## 3. Environment variables

Set these in Vercel under Project Settings -> Environment Variables (Production and Preview).

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public by design; RLS protects data) |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Enables client error reporting when set |
| `SENTRY_DSN` | No | Enables server/edge error reporting when set |
| `SENTRY_AUTH_TOKEN` | No | Build-time only; enables source-map upload |
| `MODEL_API_URL` | No | Live pricing inference endpoint; falls back to DB rates if unset |
| `MODEL_API_TOKEN` | No | Auth token for the pricing API, if used |
| `MODEL_API_TIMEOUT_MS` | No | Defaults to 2000 |

Do not set `SUPABASE_SERVICE_ROLE_KEY` in Vercel. It bypasses Row Level Security and is only used by the local `seed-crew-accounts.mjs` script.

## 4. Deploy on Vercel

1. In Vercel, click New Project and import the GitHub repository.
2. Framework preset: Next.js (auto-detected). Build command and output are the defaults.
3. Add the environment variables from the table above.
4. Deploy. Vercel builds and gives you a `*.vercel.app` URL.

## 5. Custom domain

1. Vercel -> Project -> Settings -> Domains -> Add, then enter your domain.
2. At your domain registrar, add the DNS records Vercel shows:
   - Apex domain (`example.com`): an `A` record to Vercel's IP, or an `ALIAS`/`ANAME` if your registrar supports it.
   - `www`: a `CNAME` to `cname.vercel-dns.com`.
3. Wait for DNS to propagate; Vercel issues the TLS certificate automatically.
4. Set the primary domain and, if desired, redirect `www` to the apex (or vice versa).

## 6. Supabase configuration

- Add your production domain to Supabase -> Authentication -> URL Configuration (Site URL and redirect URLs), otherwise email links and auth redirects point at localhost.
- Row Level Security is already enabled on all tables. No further action is needed.
- (Recommended) Supabase -> Authentication -> Providers -> enable "Leaked password protection".

## 7. Sentry (optional)

Sentry is code-complete and stays off until a DSN is present.

1. Create a Sentry project (platform: Next.js). The org/project in `next.config.ts` are `amartya` / `trashium` - adjust if yours differ.
2. Copy the DSN into `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` in Vercel.
3. Create a Sentry auth token with source-map upload scope and set `SENTRY_AUTH_TOKEN` in Vercel (mark it as sensitive / build-time).
4. Redeploy. Errors from server, edge, and client runtimes will report, with PII scrubbed by `lib/sentry-scrub.ts`.

## 8. Post-deploy checks

- Landing page loads and live per-sector rates render.
- Sign up, then sign in; confirm you land on the correct role view.
- Schedule a pickup and confirm a price quote appears.
- Crew and admin views load for their respective roles.
- If Sentry is enabled, trigger a test error and confirm it appears in Sentry.

## Notes

- The Content-Security-Policy in `next.config.ts` ships in Report-Only mode. Once you have reviewed reports in production, switch the header key to `Content-Security-Policy` to enforce it.
- The ML pricing pipeline in `ml/` runs separately (Python) and publishes rates to Supabase; it is not part of the Vercel build.