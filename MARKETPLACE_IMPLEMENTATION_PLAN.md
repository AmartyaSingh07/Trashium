# Trashium — Marketplace + Badge System Implementation Plan [COMPLETED]

> **Status:** All Modules (A through G) have been fully implemented, verified, and integrated into the main branch.

---

### Implementation Summary
- **Module A (Eco-Levels Truth):** Canonical 20-tier system in `lib/gamification.ts` is fully wired to both the household dashboard and profile pages.
- **Module B (Badges):** DB-driven badges seed successfully and unlock states are computed live via `lib/badges.ts`. The daily quiz credits bug has been fixed.
- **Module C (Marketplace Backend):** `marketplace_items` and `redemption_orders` tables are live, and the `redeem_marketplace_item` atomic transaction RPC is deployed.
- **Module D (Marketplace Frontend):** A modern, earth-toned `/marketplace` interface features access gating (500 credits + 1 pickup), redeem flows, and "My Redemptions" history tracking.
- **Module E (Admin Management):** Admin panel supports manual badge awarding, live catalog editing, and dispatch status transitions.
- **Module F (Payout Booster Perk):** One-time +10% next-pickup payout boosts are fully functional, integrating into `lib/pricing.ts` and clearing on schedule.
- **Module G (Sync & Verification):** Unified `supabase_schema.sql` and mapped assets in `IMAGE_MANIFEST.md`. All type checks and builds pass.

---

## 0. How to use this document (agent instructions)

1. Work through the modules **in order** (A → G). Each module is independently shippable.
2. Before writing ANY routing, Server Component, or data-fetching code, **read the local
   Next.js 16 docs** (`node_modules/next/dist/docs/`). This repo is Next.js 16 + React 19;
   most training data is wrong about it. Honour compiler deprecation warnings.
3. Obey every rule in `CLAUDE.md` and `AGENTS.md`. The most load-bearing ones for this work:
   - **Server vs Client split:** data-fetching + auth guard + role redirect live in `page.tsx`
     (Server Component); all interactive UI lives in a `*-content.tsx` with `"use client"`.
   - **Never hard-code prices/rates.** Pricing comes from `price_estimates` via `lib/pricing.ts`.
   - **Operational sectors** come from `OPERATIONAL_SECTORS` in `lib/constants.ts`.
   - **Eco levels are computed, not stored** — after Module A, use the helpers in
     `lib/gamification.ts`. Never hard-code thresholds.
   - **Keep `supabase_schema.sql` in sync** with every DB change.
4. **Database delivery:** apply each migration to the live project using the **Supabase MCP**
   (`apply_migration`), AND append the equivalent SQL to `supabase_schema.sql`.
5. **DO NOT add RLS policies or `ENABLE ROW LEVEL SECURITY` on the new tables yet.** The user
   will turn RLS on later. Create the tables/columns/functions only. Put any RLS SQL in a
   **commented-out** `-- TODO(RLS, later)` block in `supabase_schema.sql` so it's ready but inert.
6. **DO NOT hard-code any badge icons or marketplace item images.** The user is supplying the
   image assets later. Store only a `image_filename` (nullable) on each row and render a neutral
   placeholder when it's null. No emoji-per-tier fallbacks baked into new components, no
   hard-coded CDN URLs in new code. (See §Image Handling.)
7. After each module, run `npm run lint`. After the last module, run `npm run build`.
8. Use a TODO/task list to track the modules and tick them off as you go.

---

## 1. Confirmed product decisions (do not re-litigate)

| # | Decision | Consequence for implementation |
|---|---|---|
| D1 | **Credits are deducted from `green_credits` on redemption.** | Redemption subtracts the item cost from `profiles.green_credits`. See **D1-NOTE** below. |
| D2 | **No credit-to-cash.** Instead ship a **Payout Booster** perk (Module F). | A redeemable marketplace perk that boosts the user's *next* pickup payout. No real cash movement. |
| D3 | **DB via Supabase MCP + sync `supabase_schema.sql`. No RLS yet.** | `apply_migration` for live changes; tables created without RLS/policies for now. |
| D4 | **Keep all 15 badges; compute what we can.** | Migrate the 15 existing badges to a DB table. Compute unlock from real data where the signal exists; leave streak/referral/quiz-count badges defined but not-yet-earnable. |
| D5 | Physical merch is **demo-fulfilled** by admin (no real logistics). | Admin advances order status: `pending → dispatched → delivered`. |
| D6 | Digital cosmetics + monthly limited-edition inventory are **Phase 2** (out of scope). | Do not build `user_cosmetics`; do not build stock-race protection beyond a simple optional `stock` column. |

> **D1-NOTE (known tradeoff — keep this comment in the code & schema):**
> `green_credits` is ALSO the lifetime score that drives the 20-tier eco-level and the
> credit-based badges. Because redemption deducts it, a user's eco-level can drop and
> credit-based badges/marketplace access can re-lock after spending. This is an accepted,
> documented decision. The clean future fix is a **dual balance** (`lifetime_credits` for
> levels/badges + `spendable_credits` wallet for purchases). Leave a `-- TODO(dual-balance)`
> marker where deduction happens so the upgrade path is obvious. Do **not** implement
> dual-balance now.

---

## 2. Current-state findings (already verified — trust these, don't re-derive)

- **Canonical eco-level system = 20 tiers** in `components/dashboard/eco-level-badge.tsx`
  (`TRASHIUM_EVALUATION_TIERS`, `getTierIcon`, `getTierIconUrl`). Levels 1–20, Seed (0) →
  Tree of Life (3000). Level 7 = "Sapling" @ 250, Level 19 = "Forest Elder" @ 2500,
  Level 20 = "Tree of Life" @ 3000.
  > NOTE: the handoff/proposal text said Sapling unlock ≈ 500 credits, but in the ACTUAL tier
  > table Sapling is Level 7 @ **250** credits. The marketplace access gate is defined
  > independently in §Module D as **green_credits ≥ 500 AND pickups_completed ≥ 1** — keep that
  > numeric gate regardless of which named tier it lands on.
- **Legacy 5-tier system** `ECO_LEVELS` + `getEcoLevel`/`getNextEcoLevel` in `lib/types.ts`
  (Seedling/Sapling/Young Tree/Urban Forest/Earth Guardian). This is stale.
- **Profile page** `app/profile/profile-content.tsx` uses a THIRD, separate 3-tier label system
  (`getEvolutionTier`: Germinating Seed / Mature Sapling / Tree of Life @ 0/1500/3000) AND a
  hard-coded `badgesList` of 15 badges with hard-coded CDN filenames and partly hard-coded
  `unlocked` flags. This is the main thing Module B fixes.
- **Schema** (`supabase_schema.sql`): tables `profiles`, `pickup_requests`, `global_impact`,
  `price_estimates`. No badge or marketplace tables exist. `profiles` has `green_credits`,
  `kg_recycled`, `co2_saved`, `pickups_completed`, `eco_level`.
- **Credit awarding** in `app/dashboard/dashboard-content.tsx`:
  - Waste segregation: `+2` → correctly writes `green_credits` (≈ line 85–97).
  - Quiz correct answer: `+1` BUT writes to a column called **`total_points`** (≈ line 199),
    which does not exist in the schema / `Profile` type. **This is a pre-existing bug.** Fix it
    in Module B-fix to write `green_credits` atomically.
- **Admin** is a single `app/admin/admin-content.tsx` (client) + `app/admin/page.tsx` (server).
  It uses shadcn `Card`/`Table`/`Select`/`DropdownMenu` and a Supabase realtime subscription.
  No tab system today — marketplace admin will be added as new sections here.
- **Supabase project ref** seen in code: `fqbjjcbrxrokvdwkydze` (storage buckets
  `gamification-levels`, `gamification-badges` already referenced). Confirm via
  `list_projects` / `get_project` before applying migrations.

---

## 3. Image handling (applies to badges AND marketplace items)

The user will upload artwork later. Until then:

- Every badge row and marketplace item row has a nullable `image_filename TEXT`.
- New components build the public URL **only** from `NEXT_PUBLIC_SUPABASE_URL` + bucket +
  `image_filename`, and **only when `image_filename` is non-null**. When null, render a neutral
  placeholder (a plain rounded tile with the item/badge initial or a generic outline icon —
  NOT a themed emoji set, NOT a guessed filename).
- Buckets: badges → existing `gamification-badges`; marketplace items → new bucket
  `marketplace-items` (create via MCP/storage or note for the user to create — a missing bucket
  must degrade to the placeholder, never crash).
- Add a short **`IMAGE_MANIFEST.md`** at repo root listing the expected `image_filename` for
  every badge and every marketplace item, so the user can name/upload assets to match. The DB
  rows seed with `image_filename = NULL`; the user (or a later step) sets filenames once art
  exists.

---

## MODULE A — Single source of truth for eco-levels  *(foundational; do first)*

**Goal:** one canonical tier system the badge + marketplace code can rely on, including a
numeric **level number** (1–20) needed for level-gated rewards (e.g. Forest Elder = Level 19).

1. Create `lib/gamification.ts`:
   - Export `TRASHIUM_EVALUATION_TIERS` (move the array out of `eco-level-badge.tsx`; add an
     explicit `level: 1..20` field to each entry).
   - Export helpers (pure, no React): `getTier(credits) -> {rank, level, minPoints}`,
     `getNextTier(credits) -> tier | null`, `getLevelNumber(credits) -> number`,
     `getTierByRank(rank)`, and `getTierIconFilename(rank)` (filename only, no URL).
2. Refactor `components/dashboard/eco-level-badge.tsx` to import from `lib/gamification.ts`
   instead of defining the array inline. Keep its existing visual output identical.
3. Refactor `app/profile/profile-content.tsx` to drive its avatar/tier label from
   `getTier()`/`getLevelNumber()` — delete the local 3-tier `getEvolutionTier`. Keep the page's
   look; just source the tier name/level from the canonical helper.
4. In `lib/types.ts`, mark `ECO_LEVELS`/`getEcoLevel`/`getNextEcoLevel` as
   `@deprecated` (JSDoc) and ensure nothing imports them anymore (grep the repo). Do not delete
   yet if anything still references them — instead repoint those references to `lib/gamification.ts`.

**Acceptance:** dashboard eco-level badge and profile tier render exactly as before; the tier
array exists in exactly one place; `getLevelNumber()` returns 19 for 2500 credits and 20 for 3000.

---

## MODULE B — Badge system: DB-driven + computed

### B-1. Schema (apply via MCP; mirror in `supabase_schema.sql`; NO RLS yet)

`badges` (catalog of all 15):
```
id              TEXT PRIMARY KEY            -- 'b1'..'b15' (keep existing ids)
title           TEXT NOT NULL
description     TEXT NOT NULL
image_filename  TEXT                        -- nullable; user supplies art later
category        TEXT NOT NULL               -- 'milestone' | 'streak' | 'material' | 'social' | 'special'
unlock_type     TEXT NOT NULL               -- 'credits' | 'pickups' | 'kg' | 'categories' | 'streak' | 'referral' | 'quiz' | 'manual'
unlock_threshold NUMERIC                     -- nullable; meaning depends on unlock_type
sort_order      INT NOT NULL DEFAULT 0
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

`user_badges` (only for badges that can't be derived live — manual/campaign grants):
```
id          UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
badge_id    TEXT NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE
awarded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE (user_id, badge_id)
```

Seed `badges` with the existing 15 (preserve ids/titles/descriptions from
`profile-content.tsx`), `image_filename = NULL`, classified like so:

| id | title | unlock_type | threshold | computable now? |
|----|-------|-------------|-----------|-----------------|
| b1 | Trash-to-Treasure | pickups | 1 | yes |
| b2 | Sprouting Value | credits | 250 | yes |
| b3 | Eco Rookie | streak | 7 | no (placeholder) |
| b4 | Green Momentum | credits | 1500 | yes |
| b5 | Unstoppable Recycler | streak | 100 | no |
| b6 | Waste Warrior | streak | 250 | no |
| b7 | Paper Protector | kg | 50 | partial* |
| b8 | Plastic Patrol | kg | 30 | partial* |
| b9 | Metal Maverick | kg | 100 | partial* |
| b10 | Eco Influencer | referral | 5 | no |
| b11 | Eco Brainiac | quiz | 100 | no |
| b12 | Circular Citizen | categories | 7 | yes** |
| b13 | Trashium Veteran | manual | (1 yr) | no |
| b14 | Forest Elder | credits | 2500 | yes (Level 19) |
| b15 | Planet Partner | manual | — | manual grant |

\* The per-material kg badges (b7/b8/b9) need per-waste-type kg totals. If those aren't tracked,
treat as **not computable** (locked) for now — do NOT invent data. Optionally, if you can derive
per-material kg by summing `pickup_requests` of that `waste_type` with status `processed`, compute
them; otherwise leave locked.
\*\* b12 "recycled across every category" = distinct `waste_type` count across the user's
`processed` pickups ≥ 7. Compute from `pickup_requests` if feasible; else locked.

### B-2. Computation logic

Create `lib/badges.ts` (pure, server-safe):
- `computeBadgeState(profile, signals)` where `signals` carries any extra derived data you can
  cheaply gather (e.g. distinct categories, per-material kg, list of manually-awarded badge ids
  from `user_badges`). Returns, per badge id, `{ unlocked: boolean }`.
- Rules: `credits` → `green_credits >= threshold`; `pickups` → `pickups_completed >= threshold`;
  `kg` → per-material or total kg as available; `categories` → distinct processed categories ≥
  threshold; `streak`/`referral`/`quiz` → `false` for now (no signal) ; `manual` → true iff a
  matching `user_badges` row exists.
- Forest Elder (b14): use `getLevelNumber(green_credits) >= 19` OR `green_credits >= 2500`
  (equivalent) so it stays consistent with Module A.

### B-3. Wire into the profile page

- `app/profile/page.tsx` (Server Component): fetch `badges` (catalog), the user's `user_badges`,
  and any derived signals; pass a fully-resolved badge list (with `unlocked` + `image_filename`)
  down to `profile-content.tsx`.
- `app/profile/profile-content.tsx`: **delete the hard-coded `badgesList`** and the hard-coded
  `cdnBadgeBase` usage. Render from the props. For each badge: build the image URL only if
  `image_filename` is set, else render the neutral placeholder. Keep the existing locked/unlocked
  visual styling (grayscale/opacity for locked, tooltip with description + Locked/Unlocked).

### B-fix. Quiz credit bug

In `app/dashboard/dashboard-content.tsx`, the quiz-correct path writes `total_points` — change it
to atomically increment `green_credits` (match the segregation path's pattern). Verify the daily
cap logic (max 5 correct/day, 2 strikes) still holds. Keep behaviour otherwise identical.

**Acceptance:** profile badges come entirely from the DB; no hard-coded badge array or icon URLs
remain in `profile-content.tsx`; credit-based badges unlock at the right thresholds against a test
profile; missing art shows the placeholder, not a broken image; quiz correct answers now move
`green_credits`.

---

## MODULE C — Marketplace data layer

### C-1. Schema (apply via MCP; mirror in `supabase_schema.sql`; NO RLS yet)

`marketplace_items`:
```
id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4()
name                TEXT NOT NULL
description         TEXT NOT NULL
tier                TEXT NOT NULL          -- 'seedling' | 'sapling' | 'forest' | 'perk' | 'legendary'
cost_credits        INT NOT NULL CHECK (cost_credits >= 0)
image_filename      TEXT                   -- nullable; art later
level_requirement   INT                    -- nullable; min eco-level number (1..20)
badge_requirement   TEXT REFERENCES public.badges(id)   -- nullable; required badge id
stock               INT                    -- nullable = unlimited
is_active           BOOLEAN NOT NULL DEFAULT true
perk_type           TEXT                   -- nullable; 'payout_boost' for Module F items
perk_value          NUMERIC                -- nullable; e.g. boost percent
sort_order          INT NOT NULL DEFAULT 0
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

`redemption_orders`:
```
id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
item_id             UUID NOT NULL REFERENCES public.marketplace_items(id)
item_name           TEXT NOT NULL          -- snapshot for history
cost_at_redemption  INT NOT NULL           -- snapshot
status              TEXT NOT NULL DEFAULT 'pending'  -- 'pending'|'dispatched'|'delivered'|'cancelled'
shipping_note       TEXT
created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

### C-2. Seed the catalog (`image_filename = NULL` for all)

Seed from the refined proposal. Costs in credits:

- **Tier `seedling`:** Sticker Pack 500; Eco Bookmark 600; Seed Paper Card 750; Eco Pouch 1000.
- **Tier `sapling`:** Eco Cap 1800; Tote Bag 2000; Ceramic Mug 2500; Recycled Notebook 3000.
- **Tier `forest`:** Organic Tee 5000; Forest Elder Tee 7000 (`badge_requirement = 'b14'`);
  Hoodie 9000.
- **Tier `legendary`:** Forest Elder Collector Mug 5000 (`badge_requirement = 'b14'`);
  Planet Partner Kit 7000 (`badge_requirement = 'b15'`).
- **Tier `perk`:** Payout Booster (Module F) — `perk_type='payout_boost'`, set `cost_credits`
  and `perk_value` per Module F.

(Variants like sizes/colourways are presentation-only for now; encode in `description`.)

### C-3. Atomic redemption RPC

Create a Postgres function `redeem_marketplace_item(p_item_id uuid)` (PL/pgSQL,
`SECURITY DEFINER`, `search_path = public`) that runs as one transaction:
1. Resolve `auth.uid()` as the user; load the user's `profiles` row and the item.
2. Validate: item `is_active`; `stock` is null or > 0; user meets `level_requirement`
   (`getLevelNumber` equivalent inline: derive level from `green_credits` against the tier
   thresholds — or pass the computed level from the app and re-check); user holds
   `badge_requirement` if set (credits/level-based via threshold, or a `user_badges` row for
   manual badges); **`green_credits >= cost_credits`**.
3. On success: `green_credits := green_credits - cost_credits`  *(D1; leave a
   `-- TODO(dual-balance)` comment here)*; decrement `stock` if not null; insert a
   `redemption_orders` row (snapshot name + cost, status `pending`); if `perk_type='payout_boost'`
   set the user's pending boost (Module F).
4. Return a structured result (success + new balance, or a typed error code:
   `insufficient_credits` | `locked_level` | `locked_badge` | `out_of_stock` | `inactive`).

Expose it so the client can call `supabase.rpc('redeem_marketplace_item', { p_item_id })`.
Because RLS is off for now, the function still must do all the validation itself.

**Acceptance:** calling the RPC with insufficient credits returns `insufficient_credits` and
changes nothing; a valid call deducts credits, writes an order, and (if stocked) decrements stock,
all atomically.

---

## MODULE D — Marketplace user UI (`/marketplace`, household)

1. `app/marketplace/page.tsx` (Server Component): auth guard + role check (household; mirror the
   pattern in `app/dashboard/page.tsx`), fetch active `marketplace_items`, the user's `profiles`
   row, their `user_badges`, and the user's `redemption_orders`. Compute, server-side, per item:
   `affordable`, `meetsLevel`, `meetsBadge`, and overall `redeemable`.
2. `app/marketplace/marketplace-content.tsx` (`"use client"`): the UI.
   - **Access gate:** marketplace is "unlocked" when **`green_credits >= 500` AND
     `pickups_completed >= 1`**. Until then show a locked hero explaining how to unlock (schedule
     a pickup + earn credits). *(Per D1-NOTE, spending below 500 can re-lock access — that's
     expected; leave a `-- TODO(dual-balance)` note.)*
   - Grouped by tier (Seedling / Sapling / Forest / Perks / Legendary) with the brand styling
     used elsewhere (`t-glass-card`, Syne/DM-Sans, earth tokens).
   - Each card shows cost, the user's current balance, lock reasons (e.g. "Requires Forest Elder
     badge", "Reach Level 19", "Need 1500 more credits"), and a **Redeem** button (disabled with
     reason when not redeemable). Images via the placeholder rule.
   - Redeem → confirm modal → `supabase.rpc('redeem_marketplace_item', …)` → on success, toast +
     optimistic balance update + refresh orders; on typed error, show the matching message.
   - A "My Redemptions" section listing the user's orders with status.
3. Add a **Marketplace** nav entry wherever the household nav lives (check
   `components/layout/` and the dashboard header). Use the existing nav component/pattern.

**Acceptance:** a household user below the gate sees the locked state; above it, sees tiers; an
affordable unlocked item redeems end-to-end and the balance + order list update; locked items show
correct reasons and cannot be redeemed.

---

## MODULE E — Admin marketplace management

Extend `app/admin/admin-content.tsx` (+ fetch in `app/admin/page.tsx`) with two sections,
matching the page's existing card/table styling:

1. **Catalog management:** table of `marketplace_items` with create / edit / toggle `is_active` /
   set `stock` / set `cost_credits` / set `level_requirement` / `badge_requirement` /
   `image_filename`. (Use the existing shadcn `Table`/`Input`/`Select`/`Dialog` primitives.)
2. **Redemption orders:** table of all `redemption_orders` (joined to user + item) with a status
   dropdown to advance `pending → dispatched → delivered` (and `cancelled`). Updating status writes
   `status` + `updated_at`. Reuse the existing realtime-subscription approach if straightforward.

Also add an **Award badge** control (small): admin selects a user + a `manual` badge (b13/b15) and
inserts a `user_badges` row. This is how Planet Partner / Trashium Veteran get granted.

**Acceptance:** admin can add/edit/deactivate items and advance an order's status; a manually
awarded badge then shows as unlocked on that user's profile.

---

## MODULE F — Payout Booster perk  *(the "similar reward" replacing credit-to-cash)*

Concept: a redeemable perk that adds a one-time bonus to the user's **next** pickup payout. No
cash is created — it enhances the existing per-kg payout, absorbed by the platform margin.

1. Schema: add to `profiles` →
   `pending_payout_boost_pct NUMERIC` (nullable). *(Single pending boost; keep it simple.)*
2. Catalog: one `perk` item "Payout Booster" with `perk_type='payout_boost'`,
   `perk_value = 10` (i.e. +10% on next pickup), `cost_credits` e.g. **300**. (Make value/cost
   easy to tweak; they're data, not code.)
3. Redemption: the RPC (Module C-3) sets `profiles.pending_payout_boost_pct = perk_value` when
   `perk_type='payout_boost'` (in addition to the normal deduction + order row).
4. Apply at scheduling: where a pickup quote is finalized (the schedule-pickup flow that uses
   `quotePickup`/`estimated_price`), if `pending_payout_boost_pct` is set, multiply the household
   payout (`base_price`) by `(1 + pct/100)`, persist the boosted `estimated_price`, then **clear**
   `pending_payout_boost_pct` (one-time use). Keep this logic in/near `lib/pricing.ts`
   (e.g. an `applyBoost(quote, pct)` helper) so pricing stays centralized — do NOT hard-code rates.
5. Surface it: show "Payout boost active (+X%)" in the schedule modal when a boost is pending.

**Acceptance:** redeeming the booster deducts credits, sets the pending boost; the next scheduled
pickup's `estimated_price` reflects the boost and the pending flag clears; a subsequent pickup is
unboosted.

---

## MODULE G — Sync, verify, document

1. **`supabase_schema.sql`:** ensure every new table/column/function from Modules B/C/F is appended
   (create-table statements + the RPC), with the RLS blocks present but **commented out** under
   `-- TODO(RLS, later)`.
2. **`IMAGE_MANIFEST.md`:** list expected `image_filename` per badge and per marketplace item +
   which bucket, so the user can upload art and (later) set the filenames.
3. **`CLAUDE.md`:** add the new tables, the `/marketplace` route, `lib/gamification.ts`,
   `lib/badges.ts`, and the redemption RPC to the relevant sections so the doc stays accurate.
4. **Build gates:** `npm run lint` then `npm run build` must pass. Fix all type errors
   (`marketplace_items`, `redemption_orders`, `badges`, `user_badges`, `pending_payout_boost_pct`
   need types in `lib/types.ts`).
5. **Smoke test the flows** against the live project (read-only checks via MCP `execute_sql` where
   helpful): badge unlock thresholds; redemption deduct + order insert + stock decrement; access
   gate; booster apply-once. Optionally run a verification subagent over the diff.

---

## 4. Out of scope (Phase 2 — do NOT build now)

- Dual-balance credit wallet (documented upgrade path only).
- Digital cosmetics (`user_cosmetics`), profile frames, dashboard themes.
- Monthly limited-edition inventory with atomic oversell protection beyond the simple `stock` col.
- Real logistics/fulfilment integration, payments, shipping addresses beyond a free-text note.
- Streak / referral / quiz-count tracking needed to make b3/b5/b6/b10/b11 earnable (badges exist
  but stay locked until those signals are tracked).
- Turning on RLS (user does this later; SQL is staged but commented out).

## 5. [ASK USER] checkpoints

Only pause for these:
- If a Supabase storage bucket (`marketplace-items`) can't be created via your tools — ask the
  user to create it, then continue (missing bucket must still degrade to placeholder, not crash).
- If you discover per-material kg / category data genuinely can't be derived for b7/b8/b9/b12 —
  confirm leaving them locked (default: leave locked, no fake data).
- Before deleting any legacy code (`ECO_LEVELS` etc.) if something still imports it and the
  repoint is non-trivial.
```
