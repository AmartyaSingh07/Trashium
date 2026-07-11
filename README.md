# Trashium

Trashium is an incentivized waste-management platform for households and collection crews in West Bengal. Households schedule recyclable pickups, earn Green Credits for what they divert from landfill, and level up through an eco-progression system. Collection crews manage optimized routes, and admins oversee pricing, catalog, and operational data.

Pickup rates are not guessed or hard-coded: a Python pipeline trains pricing models on historical scrap-market data and publishes per-material, per-area rates that the app reads live.

## Features

- Schedule recyclable pickups by material type and neighbourhood, with a live price quote at booking time.
- Green Credits, a 20-tier eco-level progression, badges, daily streaks, and a rewards marketplace.
- Collector view with an optimized pickup route on an interactive map.
- Admin panel for catalog, pricing, order status, and platform metrics.
- Machine-learning pricing pipeline (Linear Regression production model, Random Forest challenger, moving-average guardrail) published to the database nightly.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS v4 with a custom design-token theme
- **UI:** shadcn/ui (Base UI + Radix), Tabler & Lucide icons
- **Auth & data:** Supabase (Postgres, Auth, Row Level Security)
- **Maps:** Leaflet + react-leaflet
- **Charts:** Recharts
- **Monitoring:** Sentry (optional; off unless a DSN is set)
- **Pricing models:** Python, scikit-learn

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

Run `supabase_schema.sql` once against your Supabase project (SQL editor or `psql`) to create the tables, policies, and functions.

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
| `npm run test:unit` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run end-to-end tests (Playwright) |

## Project structure

```
app/          Next.js App Router pages (dashboard, crew, admin, marketplace, auth)
components/    UI primitives and domain components
lib/          Types, pricing, gamification, badges, Supabase clients
i18n/          next-intl configuration
messages/     Translation catalogs
ml/           Python pricing pipeline
supabase_schema.sql   Database bootstrap
```

## Pricing pipeline

The `ml/` directory holds a self-contained Python pipeline that regenerates the training dataset, trains the models, applies a moving-average trend guardrail, and publishes the resulting rates to the `price_estimates` table. See `ml/README.md` for details.

## Deployment

The app is built to deploy on Vercel. See `DEPLOYMENT.md` for the full walkthrough (environment variables, custom domain, and Sentry setup).

## License

Academic project. All rights reserved.