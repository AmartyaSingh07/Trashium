# Trashium

Trashium is an incentivized waste-management platform for households and collection crews in West Bengal. Households schedule recyclable pickups, earn Green Credits for what they divert from landfill, and progress through an eco-level system. Collection crews work optimized routes with photo-verified pickups, and admins manage pricing, the rewards catalog, and operational data.

Pickup rates are not guessed or hard-coded. A machine-learning model trained on two years of regional scrap-market data produces a per-material, per-area market value for every quote.

**Live:** [www.trashium.com](https://www.trashium.com)

## Features

- **Instant pricing** — schedule a pickup by material and neighbourhood and get a live per-kg quote that reflects material, area, quality risk, and demand.
- **Gamified recycling** — Green Credits, a multi-tier eco-level progression, badges, daily streaks, and a rewards marketplace with redemptions.
- **Crew operations** — a collector view with an interactive Leaflet map, zone-scoped pickup queues, and geo-tagged proof photos.
- **Admin hub** — manage the marketplace catalog, pricing, order status, and platform metrics.
- **Multilingual** — English, Hindi, and Bengali (next-intl).
- **Installable PWA** — add to home screen, with a service worker for light offline support.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS v4 with a custom design-token theme
- **UI:** shadcn/ui (Base UI + Radix), Tabler and Lucide icons, Motion for animation
- **Auth & data:** Supabase (Postgres, Auth, Row Level Security)
- **Maps:** Leaflet + react-leaflet
- **Charts:** Recharts
- **Internationalization:** next-intl
- **Monitoring:** Sentry (optional; off unless a DSN is set)
- **Pricing model:** trained in Python with scikit-learn, served in-app (see [Pricing](#pricing))

## Pricing

The production model is a log-target linear regression that predicts market value per kg from material, region, quality-defect risk, demand, and mild seasonality. It is trained by the Python pipeline in `ml/`, but it is **not** called over the network at runtime: the trained model's parameters are embedded directly in the app (`lib/pricing-model.ts`), so quotes are computed natively during the request with no external inference service to host, scale, or keep warm.

If a quote cannot be produced for any reason, the app falls back to precomputed per-material, per-area rates stored in the Supabase `price_estimates` table, so pricing never breaks. The `ml/` pipeline (dataset regeneration, model training, a moving-average trend guardrail, and the publisher for the fallback table) is documented in `ml/README.md`.

## Getting started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project (free tier is fine)

### Install

```bash
npm install
```

### Configure environment

Copy the template and fill in your values:

```bash
cp .env.example .env.local
```

Required:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Optional (error monitoring — leave blank to keep Sentry off):

```
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_DSN=
SENTRY_AUTH_TOKEN=
```

### Set up the database

Run `supabase_schema.sql` once against your Supabase project (SQL editor or `psql`) to create the tables, Row Level Security policies, and functions.

### Run

```bash
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint the codebase |
| `npm run verify:artifacts` | Sanity-check the bundled pricing artifacts |
| `npm run test:unit` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

## Project structure

```
app/                  Next.js App Router routes (dashboard, crew, admin, marketplace, auth, content pages)
components/           UI primitives and domain components
lib/                  Types, pricing (model + math), gamification, badges, Supabase clients
i18n/                 next-intl configuration
messages/             Translation catalogs (en, hi, bn)
ml/                   Python pricing pipeline (training, evaluation, publisher)
public/               Static assets, icons, PWA service worker
supabase_schema.sql   Database bootstrap
```

## Security

- Row Level Security is enabled on every table; role-based access (household, crew, admin) is enforced in the database, not just the UI.
- Pickup proof photos live in a private storage bucket and are served to authorized staff through short-lived signed URLs.
- A Content-Security-Policy and a set of hardening headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) ship with every response.

## Deployment

The app deploys on Vercel with a Supabase backend. See `DEPLOYMENT.md` for the full walkthrough covering environment variables, the custom domain, and Sentry setup.

## License

Academic project. All rights reserved.
