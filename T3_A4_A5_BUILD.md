# T3 A4 + A5 — Build handoff (locked decisions + exact edits)

> Coordinating chat verified the live DB + code this session. Decisions below are **locked
> to the recommended options**. DB migrations wait for the user's explicit "apply". Code
> edits go to the VS Code extension (Fable); paste §3 as its prompt. Land A5 + A4 together.

---

## §0 Live facts verified this session (supersede the audit where they differ)

Confirmed against project `fqbjjcbrxrokvdwkydze`:

- **`pickup_requests`** has `estimated_weight` (numeric, NOT NULL), `estimated_price`
  (numeric, nullable), `payout_override` (numeric, nullable), `notes`, `latitude`,
  `longitude`, `user_id` (uuid). `status` text NOT NULL default `'pending'` — **no CHECK
  constraint**. Only trigger is `tr_set_pickup_updated_at` (timestamp) → no crediting today.
- **Live status distribution:** `pending 2, accepted 1, collected 1, completed 48,
  cancelled 11`. All within the canonical five → the CHECK will apply with **zero** violations.
- **`profiles`** has `green_credits`, `kg_recycled`, `co2_saved` (all numeric) and
  `pickups_completed` (integer), all NOT NULL default 0.
- **`global_impact`** columns are **`total_kg_recycled`, `total_co2_saved`,
  `total_households`** (NOT `kg_recycled`/`co2_saved`). Single row `id = 1`.
- **Crew flow already writes the correct vocabulary** (`crew-content.tsx` `updatePickupStatus`
  → `accepted|collected|completed|cancelled`), so the CHECK will not break the live crew path.

**Three findings that changed the plan:**

1. **No credit backfill.** Profile aggregates are **seeded demo values unrelated to the
   pickup rows** (e.g. a user with `pickups_completed = 28` and `green_credits = 923` has only
   5 real completed pickup rows). Retro-crediting the 48 existing `completed` rows would
   **double-count** on top of the seed. → The A4 trigger fires **only on future transitions
   into `completed`**; existing rows are left untouched. **Do not backfill.**
2. **CO₂ factor = 1.05.** The seed used exactly `co2_saved = kg_recycled × 1.05` across every
   household. Match it so new completions stay consistent. → `CO2_FACTOR = 1.05`.
3. **`global_impact` rollup targets `total_kg_recycled` / `total_co2_saved`** (not the names the
   spec assumed). Leave `total_households` alone (per-pickup completion isn't a new household;
   A7 keeps the landing on fallbacks anyway — this row is kept honest, not demo-critical).

---

## §1 Locked decisions

**A5**
- Canonical status set = `pending | accepted | collected | completed | cancelled`. Add a
  `CHECK` constraint. (Recommended ✓)
- "Physically collected" (drives the discrepancy check + "Actual Collection" column) =
  `collected` **OR** `completed`. (Recommended ✓ — else `completed` rows regress to "Awaiting Crew…")
- "Done" (terminal, credited, counted, badge signals) = `completed` only. (Recommended ✓)

**A4**
- Credit formula = `round(COALESCE(payout_override, estimated_price, 0))` — 1 credit per ₹ of
  authoritative payout. (Recommended ✓)
- `CO2_FACTOR = 1.05` kg CO₂ per kg (matches seed — see §0).
- Idempotency via a new `pickup_requests.credited_at timestamptz`; trigger guarded on
  `credited_at IS NULL`. (Recommended ✓)
- **DB trigger**, not a client RPC — can't be bypassed, no crew-client change. (Recommended ✓)
- Fires on transition **into `completed`**. No backfill.

---

## §2 DB migrations (apply from chat after user approval — NOT Fable's job)

**Migration A5 — `add_pickup_status_check`:**
```sql
ALTER TABLE public.pickup_requests
  ADD CONSTRAINT pickup_requests_status_check
  CHECK (status IN ('pending','accepted','collected','completed','cancelled'));
```

**Migration A4 — `add_pickup_completion_earn_loop`:**
```sql
-- 1. idempotency marker
ALTER TABLE public.pickup_requests
  ADD COLUMN IF NOT EXISTS credited_at timestamptz;

-- 2. earn-loop function (SECURITY DEFINER, pinned search_path — matches existing RPC convention)
CREATE OR REPLACE FUNCTION public.apply_pickup_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_weight  numeric := COALESCE(NEW.estimated_weight, 0);
  v_payout  numeric := COALESCE(NEW.payout_override, NEW.estimated_price, 0);
  v_credits numeric := round(v_payout);
  v_co2     numeric := v_weight * 1.05;   -- CO2_FACTOR, matches seed
BEGIN
  -- fire once, only on the transition INTO 'completed'
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND NEW.credited_at IS NULL THEN

    UPDATE public.profiles
      SET green_credits     = green_credits + v_credits,
          kg_recycled       = kg_recycled + v_weight,
          co2_saved         = co2_saved + v_co2,
          pickups_completed = pickups_completed + 1
      WHERE id = NEW.user_id;

    UPDATE public.global_impact
      SET total_kg_recycled = total_kg_recycled + v_weight,
          total_co2_saved   = total_co2_saved + v_co2
      WHERE id = 1;

    NEW.credited_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. BEFORE UPDATE so NEW.credited_at is persisted in the same row write
CREATE TRIGGER tr_apply_pickup_completion
  BEFORE UPDATE OF status ON public.pickup_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_pickup_completion();
```

> Notes: `BEFORE UPDATE` lets the function set `NEW.credited_at` without a second write.
> `SECURITY DEFINER` bypasses `global_impact` RLS (row is admin-write only) safely.
> After apply: mirror both into `supabase_schema.sql` and document under the schema notes in
> `CLAUDE.md`. Recommended: test on a Supabase dev branch first, then apply live.

---

## §3 Fable prompt — code edits (paste into the VS Code extension)

> Context: Trashium (Next.js 16 / React 19). We are unifying the pickup-status vocabulary
> (A5). DB migrations are handled separately — do **not** write SQL. Do **not** touch ML
> pricing, RPCs, realtime, Leaflet, or the theme. Keep `npx tsc --noEmit` green. Make exactly
> these edits:

**1. `lib/types.ts` (lines 20-25)** — replace the `PickupStatus` union with the canonical set:
```ts
export type PickupStatus =
  | "pending"
  | "accepted"
  | "collected"
  | "completed"
  | "cancelled";
```

**2. `app/admin/admin-content.tsx`** — repair every consumer of the phantom words:
- **L161** `isTimeDiscrepancy`: change `pickup.status !== "collected" && pickup.status !== "processed"`
  → `pickup.status !== "collected" && pickup.status !== "completed"`.
- **L197** CSV "Completed Pickups" count: change `p.status === "processed"` → `p.status === "completed"`.
- **L228** `isDone`: change `s === "completed" || s === "processed"` → `s === "completed"`.
- **L229** `isActive`: change `s === "accepted" || s === "confirmed" || s === "collected"`
  → `s === "accepted" || s === "collected"`.
- **L269-279** `handleStatusUpdate`: the `confirmed`/`processed` branches are now type errors.
  Simplify the mapping to write the canonical status directly (this handler is still orphaned —
  B5 decides its fate later; just make it compile and correct):
  ```ts
  const handleStatusUpdate = async (selectedPickupId: string, newStatus: PickupStatus) => {
    const mappedStatusValue: string = newStatus; // canonical values already
    // …keep the existing cancelled-vs-other branching below, using mappedStatusValue…
  ```
- **L521** "Actual Collection" cell: change `p.status === "collected" || p.status === "processed"`
  → `p.status === "collected" || p.status === "completed"`.
- **L527** status label: change `{p.status === "processed" ? "completed" : p.status}` →
  `{p.status}` (no relabel needed now).

**3. `app/profile/page.tsx` (L58)** — `const DONE_STATUSES = ["completed"];`

**4. `app/dashboard/page.tsx` (L55)** — `const DONE_STATUSES = ["completed"];`

**5. `app/crew/page.tsx` (L44)** — simplify the coercion: `status: p.status as PickupStatus`
  (the `processed → completed` map is dead now). Also, in **`app/crew/crew-content.tsx`**, the
  inline `PickupRequest.status` union (L29) and the L335 `'completed' ? 'processed'` display
  label still reference `processed`; align L29 to the canonical set and change the L335 label to
  show `p.status` directly (or keep the badge label if intentional — but drop `processed`).

**6. `CLAUDE.md`** — fix the lifecycle line to `pending → accepted → collected → completed`
  (or `cancelled`).

**Verify:** `npx tsc --noEmit` clean; repo-wide grep for `"processed"` / `"confirmed"` as status
literals returns zero functional hits; `npm run lint` clean.

---

## §4 Verification after both land

- `npx tsc --noEmit` green (the only fully-trusted gate).
- **A5:** grep shows no phantom status literals; admin CSV "Completed Pickups" is now non-zero
  (48 live); a `completed` row shows an "Actual Collection" time, not "Awaiting Crew…".
- **A4 (manual, dev — reversible):** move a **new** test pickup to `completed`; confirm the
  owner's `green_credits += round(payout)`, `kg_recycled += weight`, `co2_saved += weight×1.05`,
  `pickups_completed += 1`, and `global_impact.total_*` moved by the same deltas. Set it to
  `completed` again / update another column → **no** second credit (`credited_at` guard).
- Confirm the 48 pre-existing `completed` rows were **not** credited (they have `credited_at`
  NULL and never transitioned under the trigger).
- Frozen check: no diff under `/ml`, no pricing lib, no modal quote, no realtime/map/theme.
- Mirror migrations into `supabase_schema.sql`; update `CLAUDE.md`.

---

## §5 Open flags for the user

- **B5 cross-link:** the admin `handleStatusUpdate` (now simplified) previously wrote phantom
  statuses. Once B5 decides to restore the management table, its dropdown must offer the
  canonical five — the new CHECK constraint would reject anything else.
- **DONE_STATUSES = ["completed"]** drops `collected` from badge-signal derivation (1 live
  collected row). Consistent with "done = completed". Say so if you'd rather keep `collected`
  counting toward badge signals.
