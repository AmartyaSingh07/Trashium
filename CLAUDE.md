# Trashium — AI Agent Guide

> **Trashium** is an incentivized waste-management platform for households and collection crews
> in West Bengal. Users schedule recyclables pickups, earn Green Credits, and unlock eco-levels.
> Collectors and admins manage routes, pricing, and operational data.

---

## ⚠️ Next.js Version Warning

@AGENTS.md

This project runs **Next.js 16 + React 19** — significantly different from what most AI training
data covers. Always read `node_modules/next/dist/docs/` before touching routing, Server
Components, or data-fetching patterns. Follow any deprecation notices in the compiler output.

---

## Quick-start Commands

```bash
# Development server (localhost:3000)
npm run dev

# Lint
npm run lint

# Production build (only when explicitly needed)
npm run build

# ML pricing pipeline (Python, run from /ml)
python regenerate_dataset.py   # fix dataset
python train_models.py         # train LR + RF models → lr_mv.joblib / rf_mv.joblib
python moving_average.py       # trend guardrail
python build_price_table.py    # generate price_estimates_seed.{csv,sql}
python verify.py               # sanity gates
python publish_to_supabase.py  # upsert to Supabase price_estimates table
```

---

## Project Structure

```
/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Landing page (public)
│   ├── layout.tsx              # Root layout — fonts, Ribbons WebGL bg, grain overlay
│   ├── globals.css             # Design tokens, Tailwind v4 theme, utility classes
│   ├── login/                  # Auth: login page
│   ├── signup/                 # Auth: signup page
│   ├── profile/                # User profile page
│   ├── dashboard/              # Household dashboard (requires auth + role=household)
│   │   ├── page.tsx            # Server component — fetches profile + pickups
│   │   ├── dashboard-content.tsx # Client component — full dashboard UI
│   │   └── tracking/           # Live pickup tracking sub-route
│   ├── crew/                   # Collector view (requires auth + role=collector)
│   │   ├── page.tsx
│   │   └── crew-content.tsx
│   ├── admin/                  # Admin panel (requires auth + role=admin)
│   │   ├── page.tsx
│   │   └── admin-content.tsx
│   └── marketplace/            # Rewards marketplace (requires auth + role=household)
│       ├── page.tsx            # Server component — items, profile, badges, orders + access gate
│       └── marketplace-content.tsx # Client component — tiers, redeem flow, My Redemptions
│
├── components/
│   ├── ui/                     # Primitive UI (shadcn + custom)
│   │   ├── daily-ritual.tsx    # Daily check-in, quiz combo, milestone chest widget
│   │   ├── count-up.tsx        # Reduced-motion safe number count-up animator
│   │   └── ...                 # Button, Card, Badge, Dialog, Input, Label, Textarea, Separator
│   ├── dashboard/              # Domain components for household dashboard
│   │   ├── schedule-pickup-modal.tsx
│   │   ├── recent-pickups.tsx
│   │   ├── impact-card.tsx
│   │   └── eco-level-badge.tsx # Eco-level badge (tiers sourced from lib/gamification.ts)
│   ├── admin/
│   │   └── marketplace-admin.tsx # Admin: catalog CRUD, order status, award manual badge
│   ├── maps/
│   │   └── CrewRouteMap.tsx    # Leaflet map for collector route view
│   ├── landing/                # Landing page sections
│   ├── layout/                 # Shared layout parts (navbar, etc.)
│   └── materials/              # Material/waste-type helper components
│
├── lib/
│   ├── types.ts                # All shared TypeScript types & interfaces
│   ├── constants.ts            # OPERATIONAL_SECTORS list
│   ├── gamification.ts         # Canonical 20-tier eco-level system + helpers (single source of truth)
│   ├── badges.ts               # Badge unlock computation (pure, server-safe)
│   ├── pricing.ts              # Server-side pricing helpers (getRate, quotePickup, applyBoost)
│   ├── pricing-math.ts         # Pure pricing math (applyBoost) — client-safe
│   ├── utils.ts                # Tailwind cn() helper
│   └── supabase/
│       ├── client.ts           # Browser Supabase client
│       ├── server.ts           # Server Supabase client (cookies)
│       └── middleware.ts       # Session refresh helper
│
├── middleware.ts               # Next.js edge middleware — calls updateSession()
├── supabase_schema.sql         # Full Supabase schema (run once to bootstrap)
│
└── ml/                         # Python ML pricing pipeline
    ├── config.py               # COMMISSION (0.15), sector/category maps, fallbacks
    ├── regenerate_dataset.py   # Corrects risk/demand in raw dataset
    ├── train_models.py         # Trains LR (production) + RF (challenger) models
    ├── moving_average.py       # MA trend guardrail
    ├── build_price_table.py    # Assembles price_estimates_seed.csv / .sql
    ├── pricing.py              # Business formula (single source of truth)
    ├── publish_to_supabase.py  # Upserts to Supabase
    └── verify.py               # Sanity-check gates
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4, custom CSS design tokens |
| UI Primitives | shadcn/ui (Base UI + Radix), Tabler Icons, Lucide React |
| Animation | Motion (Framer Motion v12), OGL (WebGL Ribbons) |
| Maps | Leaflet + react-leaflet v5 |
| Charts | Recharts v3 |
| Auth & DB | Supabase (Auth + Postgres + RLS) |
| Fonts | Cormorant Garamond, Syne, DM Sans, JetBrains Mono (Google Fonts) |
| ML Pricing | Python — scikit-learn Linear Regression + Random Forest |

---

## Authentication & Role System

Auth is handled by **Supabase Auth + SSR cookies** via `@supabase/ssr`.

### Roles
| Role | Access |
|---|---|
| `household` | `/dashboard`, `/profile`, `/marketplace` |
| `collector` | `/crew` |
| `admin` | `/admin` |

> **Note:** the DB role values are `household` / `crew` / `admin` (the `profiles.role` CHECK uses
> `crew`, not `collector`). The navbar treats `crew` and `collector` interchangeably.

- `middleware.ts` calls `updateSession()` on every request to keep the session fresh.
- Server components use `lib/supabase/server.ts` (`createClient()`).
- Client components use `lib/supabase/client.ts` (`createBrowserClient()`).
- On signup, a Supabase trigger (`handle_new_user`) auto-creates a `profiles` row.
- Role checks happen in `app/dashboard/page.tsx`, `app/crew/page.tsx`, `app/admin/page.tsx`
  — redirect to `/login` if unauthenticated, redirect to appropriate role page if wrong role.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=<project url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

---

## Database Schema (Supabase Postgres)

All tables have **Row Level Security (RLS)** enabled (except for the gamification/marketplace tables which are disabled for now, pending policy setup).

### `profiles`
Auto-created on signup. Tracks eco gamification state.
- `id` (UUID, FK → auth.users)
- `role` — `'household' | 'collector' | 'admin'`
- `eco_level` — `'Seedling' | 'Sapling' | 'Young Tree' | 'Urban Forest' | 'Earth Guardian'`
- `green_credits`, `kg_recycled`, `co2_saved`, `pickups_completed`
- `current_streak` (integer, default 0) — current consecutive active days
- `longest_streak` (integer, default 0) — all-time streak high
- `last_activity_date` (date) — date of the last logged action
- `streak_freezes` (integer, default 0) — available freeze/shield count

### `pickup_requests`
- `status` lifecycle: `pending → confirmed → collected → processed` (or `cancelled`)
- `waste_type` — one of 7 types (see `WasteType` in `lib/types.ts`)
- `location` — one of the operational sectors (see `OPERATIONAL_SECTORS`)
- `estimated_price` — computed from `lib/pricing.ts` at scheduling time

### `global_impact`
Single-row table (id=1). Aggregated platform metrics. Readable by all; writable only by admin.

### `price_estimates`
ML-generated pricing table. Unique on `(waste_type, area)`. Readable by all.
- `price_per_kg` — payout to household (INR/kg)
- `logistics_per_kg`, `market_price_per_kg`, `profit_per_kg` — ML output columns
- `model_version` — model tag from the ML pipeline run

### `badges` / `user_badges`  *(gamification)*
- `badges` — catalog of all 15 (`id` `'b1'..'b15'`, `unlock_type`, `unlock_threshold`, nullable `image_filename`).
  Unlock state is **computed live** from profile data via `lib/badges.ts` (credits/pickups/kg/categories);
  `streak`/`referral`/`quiz` badges have no signal yet and stay locked.
- `user_badges` — manual/campaign grants only (e.g. Planet Partner, Trashium Veteran), granted from Admin.

### `marketplace_items` / `redemption_orders`  *(rewards marketplace)*
- `marketplace_items` — redeemable catalog (`tier`, `cost_credits`, optional `level_requirement` /
  `badge_requirement` / `stock`, `perk_type`/`perk_value`, nullable `image_filename`).
- `redemption_orders` — one row per redemption (snapshot `item_name` + `cost_at_redemption`); status
  lifecycle `pending → dispatched → delivered` (or `cancelled`), advanced by admin (demo fulfilment).
- `profiles.pending_payout_boost_pct` — one pending Payout Booster perk applied to the next pickup.
- **Redemption goes through the `redeem_marketplace_item(p_item_id uuid)` RPC** (SECURITY DEFINER):
  one transaction that validates active/stock/level/badge/credits, deducts `green_credits`, decrements
  stock, writes the order, and sets the pending boost. Call via
  `supabase.rpc('redeem_marketplace_item', { p_item_id })`.

### `daily_activity` / `streak_milestone_claims` *(daily streaks & rituals)*
- `daily_activity` — tracks a household's actions for each day.
  - `user_id` (UUID, FK → profiles)
  - `activity_date` (date, default current_date)
  - `logged_in` (boolean) — true if user logged in today
  - `segregated` (boolean) — true if user sorted waste today
  - `quizzes_correct` (integer, max 5) — quiz answers correct today
  - `quiz_strikes` (integer, max 2) — quiz strikes today
  - `weekly_active_days` (integer) — consecutive active days this week
- `streak_milestone_claims` — ledger of claimed milestone rewards.
  - `user_id` (UUID, FK → profiles)
  - `milestone_days` (integer) — 3, 7, 14, or 30 days
- **Daily logging and status run through RPC functions** (SECURITY DEFINER, public search path):
  - `log_daily_action(p_action TEXT)` — processes the daily action (`login`, `segregate`, `quiz_correct`, `quiz_wrong`), increments credits (multiplied by current streak multiplier), claims milestone chests, awards shields, and updates the user streak. Call via `supabase.rpc('log_daily_action', { p_action })`.
  - `get_daily_status()` — returns today's activity state, streak statistics, and freezes count. Call via `supabase.rpc('get_daily_status')`.
  - `get_household_leaderboard()` — retrieves public leaderboard rows filtered to households and ranked by Green Credits. Call via `supabase.rpc('get_household_leaderboard')`.

> **Credits tradeoff (D1):** `green_credits` is both the spend balance AND the lifetime score driving
> eco-levels/badges, so spending can re-lock levels/badges/marketplace access. Accepted for now; the
> upgrade path (a `lifetime_credits` + spendable wallet split) is marked with `TODO(dual-balance)`.

> **Image art:** badges → `gamification-badges` bucket; marketplace items → `marketplace-items` bucket.
> All rows seed with `image_filename = NULL` and render a neutral placeholder. See `IMAGE_MANIFEST.md`.

> **RLS:** the four new tables have **RLS disabled for now** (per current decision). Policies are staged
> but commented out under `-- TODO(RLS, later)` in `supabase_schema.sql`.

---

## Key Types (`lib/types.ts`)

```typescript
type UserRole = "household" | "collector" | "admin";
type WasteType = "Plastic" | "Paper" | "Glass" | "Metal" | "E-Waste" | "Organic" | "Mixed";
type PickupStatus = "pending" | "confirmed" | "collected" | "processed" | "cancelled";
type EcoLevelName = "Seedling" | "Sapling" | "Young Tree" | "Urban Forest" | "Earth Guardian";

// Operational sectors (West Bengal)
const OPERATIONAL_SECTORS = ['Rishra', 'Howrah', 'Shyamnagar', 'Tarakeswar', 'Hugli-Chinsura'];
```

---

## Pricing System

**Pricing is ML-driven** — a Python pipeline in `/ml` trains models on historical scrap data
and publishes rates to the Supabase `price_estimates` table nightly.

**Business formula** (from `ml/pricing.py`, consumed by `lib/pricing.ts`):
```
logistics/kg    = logistics_cost / quantity  (rate card: 111.06 + 4.80 × km)
user_payout/kg  = market_value/kg × (1 - COMMISSION) - logistics/kg
margin/kg       = COMMISSION × market_value/kg   (COMMISSION = 0.15 in config.py)
```

**Models:**
- **Linear Regression** (log market value) — production predictor, MAPE ~6.11%
- **Random Forest** — challenger/monitor, MAPE ~9.80%
- **Moving Average** — trend guardrail + cold-start fallback

**Querying prices in server code:**
```typescript
import { quotePickup } from "@/lib/pricing";
const quote = await quotePickup(sector, wasteType, weightKg);
// quote.base_price   — payout to household (INR)
// quote.profit_margin — platform margin (INR)
```

---

## UI & Design System

### Visual Layers (defined in `app/layout.tsx`)
```
z-0   WebGL Ribbons background (full-screen, fixed, pointer-events: none)
      opacity controlled per-page via CSS var --ribbon-opacity (default 0.2)
z-2   Grain texture overlay (tactile paper effect)
z-10  All page content (scrolls normally)
```

### Fonts (CSS variables)
| Variable | Font | Usage |
|---|---|---|
| `--font-cormorant` | Cormorant Garamond | Display / editorial headings |
| `--font-syne` | Syne | Bold UI headings |
| `--font-dm-sans` | DM Sans | Body text, UI |
| `--font-jetbrains` | JetBrains Mono | Code, stats, data |

### Color Palette
Defined as CSS custom properties in `app/globals.css`. Use Tailwind classes with these tokens
rather than arbitrary color values. Base palette uses warm earth tones (`linen`, `bark`).

### Component Conventions
- **Server Components**: `app/*/page.tsx` — data fetching, auth guard, role redirect
- **Client Components**: `*-content.tsx` — interactive UI with `"use client"`
- Use `components/ui/` for all primitive elements (Button, Card, Badge, etc.)
- Use `cn()` from `lib/utils.ts` for conditional class merging

---

## Agent / AI Coding Rules

1. **Read Next.js 16 docs first.** Check `node_modules/next/dist/docs/` before writing any
   routing, data-fetching, or Server Component code. APIs changed significantly.

2. **Server vs Client split matters.** Data-fetching, Supabase server client, and auth guards
   live in `page.tsx` (Server Component). All interactive UI is in `*-content.tsx` with
   `"use client"`. Do not mix them carelessly.

3. **Do not hard-code prices or waste rates.** All pricing comes from Supabase `price_estimates`
   via `lib/pricing.ts`. Use `quotePickup()` or `getRate()`.

4. **RLS is enforced on all tables.** Always use the correct Supabase client (server vs browser)
   — using the browser client in a Server Component will silently bypass RLS.

5. **Operational sectors are the canonical location IDs.** Always use the `OPERATIONAL_SECTORS`
   constant from `lib/constants.ts` as the source of truth for location values.

6. **Eco levels are computed, not stored directly.** Use `getTier(credits)`,
   `getNextTier(credits)`, and `getLevelNumber(credits)` from `lib/gamification.ts` (the canonical
   20-tier source of truth) — never hardcode threshold values. The 5-tier `ECO_LEVELS`/`getEcoLevel`
   in `lib/types.ts` is `@deprecated`. Badge unlocks use `lib/badges.ts`.

7. **Leaflet maps require `"use client"`.** The `CrewRouteMap` and tracking map components
   must never be rendered on the server. Use dynamic imports with `ssr: false` if needed.

8. **Never commit `.env.local`.** It is gitignored. The required env vars are
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

9. **ML pipeline is Python-only.** Do not attempt to run ML training from TypeScript.
   The output (updated `price_estimates` rows) is consumed via Supabase.

10. **Keep the schema SQL in sync.** If you add/modify DB columns, update
    `supabase_schema.sql` to reflect the change.

11. **Daily activities and streaks must be logged via log_daily_action RPC.** Never write directly to `profiles` streak columns or manually write daily credits updates from client components. The `log_daily_action` RPC is the sole authority for daily action logic, streak multipliers, freezes, and milestone chest claims.

12. **Micro-animations must respect reduced-motion settings.** Ensure that custom widgets (e.g., flames, leaderboards, count-ups, and ring fills) respect the `prefers-reduced-motion` media query to maintain accessibility and prevent hardware-based render lag.
