# T3_A5_SPEC — Unify the pickup-status vocabulary

> Tier 3 build spec. Written by the coordinating chat; implemented in the VS Code
> Claude Code extension ("Fable"). **Specs only — no code/DB changes until the user
> approves.** Sequence **A5 + A4 together**: A5 fixes the status words, A4 keys the
> earn loop off the canonical "done" status.

---

## §0 Goal & non-goals

**Goal.** Collapse the two competing pickup-status vocabularies down to the one the
live database actually uses, add a `CHECK` constraint so no fourth vocabulary can
creep in, and repair every consumer that silently breaks on the phantom statuses
(`confirmed`, `processed`).

**Non-goals.**
- No change to how pickups are *created* or *priced* (ML quote is frozen — see guardrails).
- No new statuses, no status-transition workflow redesign, no admin/crew UX rework
  beyond making existing consumers read the right words. (Admin table restoration is
  **B5**; the earn-loop credit on "done" is **A4**.)
- No RLS changes.

---

## §1 Verified current state (from audit; re-confirm before building)

**Live DB — `pickup_requests.status` values actually in use:**
`pending, accepted, collected, completed, cancelled`. **No `CHECK` constraint** on the
column today, so the vocabulary is unenforced.

**Phantom statuses assumed by code/docs but never written:** `confirmed`, `processed`.

**Known broken consumers (all trace back to the phantom words):**
- `app/admin/admin-content.tsx` — CSV export counts "completed" as `status === 'processed'`,
  which is **always 0**. The time-discrepancy logic (`isTimeDiscrepancy`) and the
  "Actual Collection" column only fire for `collected | processed`, so genuinely
  `completed` rows are stuck showing "Awaiting Crew…" forever.
- `DONE_STATUSES` lists in the dashboard and profile pages (server `page.tsx` files that
  compute completed-pickup counts / impact) — confirm which statuses they include; any
  reliance on `processed`/`confirmed` is dead.
- `lib/types.ts` — `PickupStatus` union lists `confirmed`/`processed` (per CLAUDE.md) and
  omits `accepted`/`completed`. This is the type-level root of the drift.
- `CLAUDE.md` documents the lifecycle as `pending → confirmed → collected → processed`,
  which does not match the live DB.

> ⚠️ **Implementer must verify §1 against live code/DB before editing** — read the four
> files above and run a read-only `SELECT DISTINCT status FROM pickup_requests;` to confirm
> the live set. The facts here are from the QA audit, not a fresh read this session.

---

## §2 Files / DB touched

**DB (via Supabase connector, `apply_migration`):**
- `pickup_requests.status` — add `CHECK (status IN ('pending','accepted','collected','completed','cancelled'))`.
  (Guard: verify no live row violates the set *before* adding the constraint, or the
  migration fails.)

**Code:**
- `lib/types.ts` — `PickupStatus` union → the canonical five.
- `app/admin/admin-content.tsx` — CSV "completed" count, `isTimeDiscrepancy`, and the
  "Actual Collection" column trigger set.
- Dashboard + profile `page.tsx` — `DONE_STATUSES` (and any status literals feeding
  counts/impact).
- Any other consumer surfaced by a repo-wide grep for the phantom words (see §7).

**Docs:**
- `CLAUDE.md` — correct the lifecycle line.
- `supabase_schema.sql` — mirror the new `CHECK` constraint (CLAUDE.md rule 10).

---

## §3 Approach + the frozen bits

Adopt the **live vocabulary** (least churn) rather than migrating live data to the
documented-but-fictional words.

1. **Define the canonical set once.** Update `PickupStatus` in `lib/types.ts` to
   `'pending' | 'accepted' | 'collected' | 'completed' | 'cancelled'`. Let TypeScript
   surface every consumer that referenced a now-removed member — `npx tsc --noEmit`
   becomes the find-list.
2. **Repair admin consumers.** In `admin-content.tsx`: the "completed" CSV count keys off
   `completed` (not `processed`); the discrepancy/"Actual Collection" trigger set becomes
   the set of statuses that represent a physically-collected pickup — decide `collected`
   only, or `collected | completed` (see §4 decision).
3. **Repair `DONE_STATUSES`.** Align to whichever statuses count as "done" for impact/counts.
   This must agree with A4's definition of the credit-triggering status so the earn loop and
   the count logic never disagree (single source of truth for "done").
4. **Add the `CHECK` constraint** after confirming clean live data; mirror into
   `supabase_schema.sql`.
5. **Fix the docs** (`CLAUDE.md` lifecycle line).

**Frozen / do not touch:** the ML pricing flow and the pickup quote in
`schedule-pickup-modal.tsx`; the realtime channels; the Leaflet map islands. Theme frozen.
Respect `prefers-reduced-motion`. Keep the server/client split. This is a pure
vocabulary/label repair — no status *transition* logic changes here.

---

## §4 Decision(s) needed

1. **Confirm the canonical set** = `pending / accepted / collected / completed / cancelled`.
   (Recommended: yes — it's what the DB already holds, zero data migration.)
2. **What counts as "physically collected" for the discrepancy + "Actual Collection"
   column?** Options: (a) `collected` only, or (b) `collected` *and* `completed` (since a
   `completed` pickup was necessarily collected first). Recommendation: **(b)** — otherwise
   `completed` rows regress to "Awaiting Crew…" again, which is the exact bug we're fixing.
3. **What counts as "done" for `DONE_STATUSES` / impact counts?** Must match A4's
   credit-trigger status. Recommendation: the terminal success status is **`completed`**;
   `collected` is in-progress. (If A4 credits on `collected` instead, this flips — resolve
   jointly in A4 §4.)

---

## §5 Verification

- `npx tsc --noEmit` clean (the only fully-trusted gate). Removing union members is the
  intentional way to force the compiler to list every consumer — fix until green.
- Repo-wide grep for `'confirmed'` and `'processed'` as status literals returns **zero**
  functional uses (docs/comments aside).
- Migration guard: `SELECT status, count(*) FROM pickup_requests GROUP BY status;` shows
  only the five canonical values *before* adding the `CHECK`.
- Manual (auth-gated, admin role): a `completed` pickup now (a) counts as completed in the
  CSV export and (b) shows an "Actual Collection" time instead of "Awaiting Crew…".
- No visual/motion change expected → reduced-motion N/A, but confirm nothing in the touched
  files alters animated components.

> Auth-gating: admin/household pages need role sessions; verify manually in dev.

---

## §6 Risks

- **Adding the `CHECK` on dirty data fails the migration.** Mitigate with the pre-check
  query; if a stray value exists, decide to normalize or widen the set *before* migrating.
- **A missed consumer** keeps reading a phantom word and silently shows 0 / "awaiting".
  The tsc-driven find-list plus the grep gate mitigate this.
- **Coupling with A4:** if A5's "done" status and A4's credit-trigger status disagree, the
  earn loop and the counters diverge. Resolve the "done" definition once, shared by both.
- **Schema drift:** forgetting to mirror the `CHECK` into `supabase_schema.sql` reintroduces
  doc drift (rule 10).

---

## §7 Implementation order

1. Read the four files in §1 + `SELECT DISTINCT status…` to confirm live reality.
2. Grep the repo for `processed` / `confirmed` status literals to build the full consumer list.
3. Update `PickupStatus` in `lib/types.ts`; run `tsc` to enumerate breakages.
4. Fix `admin-content.tsx` (CSV count, discrepancy set, "Actual Collection" trigger).
5. Fix `DONE_STATUSES` in dashboard/profile `page.tsx` — align with A4's "done".
6. Pre-check live data; `apply_migration` to add the `CHECK`; mirror into `supabase_schema.sql`.
7. Fix the `CLAUDE.md` lifecycle line.
8. `tsc` green + manual admin verification. Land with A4 in the same session.
