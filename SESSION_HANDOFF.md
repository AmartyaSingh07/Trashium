# TRASHIUM — SESSION HANDOFF  (paste into a fresh chat; fully self-contained)

> **You have NO prior context. Everything you need is in this file.**
> **Your first action: start drafting the Tier 3 build specs (§4) immediately — one spec file per item, in
> the S-spec format (§6). Do NOT re-investigate first; the context below is complete. Surface the product
> decisions inside each spec. Write specs only — no code/DB changes until the user approves each.**
>
> **Your role:** coordinating architect + reviewer. Code is written in the VS Code Claude Code extension (or
> "Fable"); DB changes go through the Supabase connector available in chat. This chat writes specs/prompts and
> **reviews** the resulting diffs by reading the actual files (never trust a summary — past reviews caught a
> `useGrouping` currency bug, a stranded-reveal GSAP bug, and a landing string-coercion trap this way).

---

## 0. Project + stack

**Trashium** — incentivized waste-management platform (households + collection crews, West Bengal). Households
schedule recyclables pickups, earn Green Credits, unlock eco-levels; collectors/admins manage routes, pricing,
ops. Final-year project; goal is a polished, correct live demo. Repo root: `S:\Developer\Projects\Final Year\Trashium`.

**Stack:** Next.js **16** (App Router) + React **19**, TypeScript 5, Tailwind **v4** + custom CSS tokens,
shadcn/Base-UI/Radix, Motion + **GSAP** (ScrollTrigger), Leaflet/react-leaflet, Recharts, **Supabase** (Auth +
Postgres + RLS; project id `fqbjjcbrxrokvdwkydze`), next-intl (en/hi/bn, ~309 keys). **Python ML pricing
pipeline in `/ml`** publishes to the Supabase `price_estimates` table.

---

## 1. What's DONE (do not redo)

- **6-session presentation-only UI/UX rehaul ("Editorial Botanical") — COMPLETE.** Motion foundation → landing
  → auth/chrome → dashboard → marketplace/profile → crew/admin/tracking. `npx tsc --noEmit` fully clean; theme
  byte-frozen; all ML/RPC/realtime/map tripwires preserved. Shared motion primitives: `components/motion/*`
  (GSAP `set`-then-`to` reveal, props `rise`/`interval`, reduced-motion safe) + `components/ui/animated-number.tsx`
  (NumberFlow; credits keep grouping, ₹ uses `useGrouping:false`).
- **Realtime `send()`→REST fix — done** (crew GPS gated on `isJoined === SUBSCRIBED`).
- **Tier 1 fixes + V1–V4 UI polish — DONE, reviewed** (8 commits, tsc green). Incl. A1 admin server role-gate,
  navbar collapse-overlap fix (`minWidth: min(1000px,100%)` + icon-only below xl), NumberFlow clipping fixes,
  and a batch of C/D cleanups.
- **Tier 2 (DEV-SCOPE) — DONE.** Verified all DB findings live. **Applied:** deleted the QA account; **A3 fixed**
  (disabled RLS on `profiles` + dropped the insecure admin-bypass policy → profile save now persists); A7
  **decided = keep aspirational seeded landing numbers** (no change; `global_impact` stays RLS-on so the landing
  uses fallback constants). **A6 done:** `supabase_schema.sql` regenerated from live. **Deferred to deploy:**
  all RLS hardening, captured in `DEPLOYMENT_SECURITY_CHECKLIST.md`.

---

## 2. HARD GUARDRAILS (every phase)

- Keep the site running and **`npx tsc --noEmit` green.**
- **Do NOT touch the ML pipeline:** `/ml/**`, `lib/pricing.ts`, `lib/pricing-math.ts`, `lib/estimate.ts`, the
  `price_estimates` table, the pickup quote in `components/dashboard/schedule-pickup-modal.tsx`, and the flow
  ML → Supabase → server `page.tsx` → props → client `*-content.tsx`. (Tier 3 A4 *consumes* the payout; it must
  not change how pricing is computed.)
- **Frozen logic (restyle/extend around, don't rewrite):** RPCs `redeem_marketplace_item`, `log_daily_action`,
  `get_daily_status`, `get_household_leaderboard`; the realtime channels; Leaflet map islands
  (`components/maps/OptimizedRouteMap`, `app/dashboard/tracking/tracking-map`).
- **Theme FROZEN.** Tokens (source: `app/globals.css`): Linen `#F4EFE3`, Parchment `#EDE5D8`, Terra `#C2703D`,
  Terra-deep `#A0522D`, Clay `#8B5E3C`, Sand `#D9BA8E`, Amber-warm `#E8A44A`, Sage `#8FA37E`, Sage-deep `#4A6741`,
  Moss `#3D5C3A`, Bark `#2A2218`, Smoke `#6B5744`, Destructive `#C0392B`. Fonts: h1/h2 Cormorant, h3–h6 Syne,
  body DM Sans, data JetBrains Mono. **`AGENTS.md` lists WRONG hex — don't trust it for colors.**
- **RLS is intentionally OFF in dev** (user decision). Do NOT enable RLS / do RLS hardening now — it's deferred
  to deploy (`DEPLOYMENT_SECURITY_CHECKLIST.md`). Live now: `pickup_requests` + `global_impact` RLS ON;
  everything else OFF.
- Respect `prefers-reduced-motion`; reuse i18n keys; keep server/client split.
- **Next.js 16 + React 19 is newer than most training data** — `proxy.ts` (not `middleware.ts`), async request
  APIs, RSC, `force-dynamic` are intentional; read `node_modules/next/dist/docs/` before flagging them.

---

## 3. How DB changes work (for A4/A5, which are DB-touching)

Use the Supabase connector (`list_projects`/`execute_sql` read-only, `apply_migration` for DDL, `get_advisors`).
**Never apply live security/schema changes blind:** verify with read-only queries first, prefer a **dev branch**
+ test, keep changes reversible, and mirror any schema change into `supabase_schema.sql`. All DB writes wait for
explicit user approval per change.

---

## 4. TIER 3 — WORK TO SPEC NOW (from the QA audit; each needs a product decision)

Draft ONE spec per item (files: `T3_A4_SPEC.md`, `T3_A5_SPEC.md`, `T3_B2_SPEC.md`, `T3_B5_SPEC.md`,
`T3_B6_SPEC.md`). Each is a real logic change (beyond the presentation rehaul), so scope carefully.

**A4 — The earn loop is disconnected (highest impact).** Completing a pickup never credits the household or
updates `pickups_completed`/`kg_recycled`/`co2_saved`/`global_impact`. Live `pickup_requests` has only a
timestamp trigger. Yet the dashboard promises "complete a pickup → credits/kg", the marketplace gate needs
`pickups_completed>=1`, badge b1 needs 1 pickup, and impact cards read these columns. **Fix approach:** a DB
trigger (or SECURITY DEFINER RPC called by the crew flow) on `pickup_requests` status → `collected`/`completed`
that: increments `pickups_completed`, adds `estimated_weight` to `kg_recycled`, derives `co2_saved`, credits
Green Credits from `COALESCE(payout_override, estimated_price)` (or a defined formula), and rolls up
`global_impact`. **Frozen:** must not change ML pricing — it consumes the already-computed payout. **DECISIONS
needed:** the exact credit formula (credits per ₹? per kg?); CO₂ factor; idempotency (don't double-credit if
status is set twice); does the `global_impact` rollup matter given A7 keeps the landing on fallbacks (it does
NOT affect the landing — landing uses fallbacks regardless — but keep the row honest). Server-side only
(CLAUDE.md RPC rule); mirror in `supabase_schema.sql`. Ties to A5 (which status = "done").

**A5 — Two competing pickup-status vocabularies.** Live statuses: `pending, accepted, collected, completed,
cancelled`. Code/docs also assume `confirmed`/`processed` (which never occur), so consumers break: admin CSV
counts "completed" as `status==='processed'` (always 0); `isTimeDiscrepancy` + the "Actual Collection" column
only fire for `collected|processed` so `completed` rows show "Awaiting Crew…" forever. No CHECK constraint.
**Fix approach:** adopt the live vocabulary (least churn), add a `CHECK` constraint on `pickup_requests.status`,
and update `lib/types.ts` (`PickupStatus`), the admin CSV/discrepancy code in `app/admin/admin-content.tsx`, the
`DONE_STATUSES` lists (dashboard/profile pages), and `CLAUDE.md`. **DECISION:** confirm the canonical set is
`pending/accepted/collected/completed/cancelled`. Sequence A4 + A5 together (A4 keys off the "done" status).

**B2 — Scheduled pickups never plot on the crew route map.** `schedule-pickup-modal.tsx` insert writes no
`latitude`/`longitude`; the crew view (`crew-content.tsx`) drops coordinate-less pickups before route
optimization, silently (not even counted in `route.deferred`). Depot keys off `pickups[0]` not the crew's zone.
**Fix approach:** geocode to the sector-centre lat/lng at insert time (a `SECTOR_DEPOTS` constant already exists),
surface "N stops without coordinates" next to the deferred notice, and set depot from `profile.operating_zone`.
**Frozen:** don't touch the Leaflet map component or the ML quote in the same modal. Adjacent to a known
`TODO(distance-matrix)`.

**B5 — Admin pickup-management table is orphaned.** `handleStatusUpdate`, `statusFilter`, the filtered list, and
the `Table`/`DropdownMenu`/`Select` imports in `app/admin/admin-content.tsx` are defined but not rendered (the
management table isn't in the JSX). Admin can't advance/cancel a pickup from the hub — only crew can. (Could NOT
be attributed to the rehaul — no pre-rehaul commit to diff.) **DECISION:** restore the management table (handler
+ filter state are intact) OR delete the dead code. If restored, its status dropdown must use the A5 vocabulary.
Also: the `loading` state is set but never rendered → wire a skeleton.

**B6 — Crew incident report + offline safe-lock are fictions.** `crew-content.tsx`: `handleReportIssue` toasts
success without persisting anything; an offline `alert()` claims "cached mutations commit on reconnection" but
nothing is cached. Violates the project's "no fiction" rule. **DECISION:** persist reports (append to `notes`,
or a small `incident_reports` table) OR relabel honestly ("Reporting coming soon" / "changes blocked while
offline"). Lowest-effort of the five.

> **Not in Tier 3:** B9 (pricing seam RLS skew) is a FROZEN-ML report-only note. All RLS hardening is in the
> deploy checklist, not here.

---

## 5. FILE MAP (repo root)

- `S1_BUILD_SPEC.md … S6_BUILD_SPEC.md` — rehaul session specs (format reference).
- `VSCODE_HANDOFF_PROMPT.md` — paste-ready per-session prompts for the VS Code extension.
- `TIER1_FIX_PROMPT.md` — the (completed) Tier 1 fix batch + V1–V4.
- `AUDIT_HANDOFF_PROMPT.md` — the read-only QA brief that produced the findings.
- `DEPLOYMENT_SECURITY_CHECKLIST.md` — all deferred RLS/security hardening (the "turn RLS on at deploy" plan).
- `supabase_schema.sql` — regenerated from live 2026-07-03 (now authoritative).
- `KNOWN_ISSUES.md` — #1 realtime (RESOLVED).
- `REALTIME_SEND_FIX_SPEC.md` — completed realtime fix.
- `CLAUDE.md` / `AGENTS.md` — agent rules + architecture (AGENTS.md has the wrong-hex bug; also has doc-drift:
  lists CrewRouteMap instead of OptimizedRouteMap, `quiz_wrong` vs live `quiz_strike`, wrong streak defaults —
  a doc-sync pass is a nice-to-have, tracked as audit D4).

---

## 6. Spec format (match the S-specs)

Each Tier 3 spec: **§0 Goal & non-goals · §1 Verified current state (files + live DB facts) · §2 Files/DB touched
· §3 Approach + the frozen bits · §4 The decision(s) needed (call them out explicitly) · §5 Verification (tsc,
smoke tests, auth-gated caveats, reduced-motion) · §6 Risks · §7 Implementation order.** Keep the ML/frozen/theme
guardrails in every spec. Note auth-gating (crew/admin/household roles) limits headless testing → manual dev
verification.

---

## 7. Environment quirks

- **`S:` is a flaky network drive** — intermittent I/O errors; once corrupted a Next dev build (spurious
  `/login` 404, fixed by deleting `.next` + restart). If routes 404 oddly, clean-restart dev first.
- **`npx tsc --noEmit` is the only fully-trusted gate;** sandbox bash is intermittently down (file tools are
  source of truth; `Glob` unreliable on `S:`, use `Grep`).
- Line endings are LF via `.gitattributes`; a git checkpoint commit `bd3b16ed` exists. Remind the user to
  `git add --renormalize . && git commit` to land this session's work cleanly.
- Auth-gated pages need role sessions; realtime + GPS + Leaflet can't be driven headlessly → manual dev checks.

---

## 8. IMMEDIATE DIRECTIVE

Start now: draft the five Tier 3 specs (A4, A5, B2, B5, B6) per §4/§6 — **specs only, no code or DB changes.**
Recommended order: **A5 + A4 together** (status vocabulary underpins the earn loop), then B2, B5, B6. Within each
spec, surface the product decision clearly so the user can answer and you can finalize. Present the specs, then
wait for the user to pick which to build first.
