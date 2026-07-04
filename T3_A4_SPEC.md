# T3_A4_SPEC — Connect the earn loop (pickup completion → credits + impact)

> Tier 3 build spec. Implemented in the VS Code Claude Code extension ("Fable").
> **Specs only — no code/DB changes until the user approves.** Highest-impact item.
> Build **with A5** — A4 credits on the canonical "done" status A5 defines.

---

## §0 Goal & non-goals

**Goal.** Make completing a pickup actually reward the household. When a pickup reaches
its terminal "done" status, one server-side, idempotent action must:
increment `pickups_completed`, add the pickup weight to `kg_recycled`, derive and add
`co2_saved`, credit Green Credits from the already-computed payout, and roll up the
single-row `global_impact` table — all in one transaction.

**Why it matters.** The dashboard promises "complete a pickup → credits/kg", the
marketplace access gate needs `pickups_completed >= 1`, badge **b1** needs 1 pickup, and
the impact cards read these columns. Today none of it moves: live `pickup_requests` has
only a timestamp trigger — completion credits nothing.

**Non-goals.**
- **Do not change how price is computed.** A4 *consumes* the payout that ML already
  produced; it must not touch pricing (see frozen bits).
- No change to the landing page. Per the A7 decision the landing uses fallback constants
  regardless, so the `global_impact` rollup does **not** affect it — but we keep the row
  honest anyway.
- No streak/daily-ritual logic (that's `log_daily_action`, frozen).
- No marketplace/badge code changes — those already read these columns; fixing the columns
  is enough.

---

## §1 Verified current state (from audit; re-confirm before building)

- **Live `pickup_requests`** has **only a timestamp trigger**; no crediting side-effects on
  status change.
- **`profiles`** carries `green_credits`, `kg_recycled`, `co2_saved`, `pickups_completed`
  (plus streak/marketplace columns). These are the columns to increment.
- **`global_impact`** — single-row table (`id = 1`), aggregated platform metrics,
  RLS **ON** (readable by all, writable by admin). A trigger/RPC running `SECURITY DEFINER`
  can update it server-side.
- **Payout source:** the pickup row already holds the computed payout. Audit names it as
  `COALESCE(payout_override, estimated_price)` — **confirm the exact live column name(s)**
  (`estimated_price`, and whether a `payout_override` column exists) before writing SQL.
- **Weight source:** audit references `estimated_weight` — **confirm the live column name**
  (CLAUDE.md's pricing section uses `weightKg`/quantity; the table column may be
  `estimated_weight` or similar).
- **Status trigger point:** depends on A5. The "done" status is expected to be `completed`
  (with `collected` as the in-progress physical hand-off). Confirm jointly with A5 §4.

> ⚠️ **Implementer must verify column names + the timestamp trigger against live DB**
> (`\d pickup_requests`, `\d profiles`, `\d global_impact`, and `SELECT` a sample row)
> **before** writing the migration. Wrong column names = silent no-op.

---

## §2 Files / DB touched

**DB (Supabase connector, `apply_migration`):**
- New `SECURITY DEFINER` function (public search path pinned) that performs the credit +
  rollup transaction — call it `apply_pickup_completion(...)` or similar.
- A trigger on `pickup_requests` that fires the function when `status` transitions **into**
  the "done" status (see §3/§4 for trigger-vs-RPC decision).
- Idempotency guard column/ledger (see §4) so a status re-write can't double-credit.

**Code (only if RPC-call approach is chosen over a pure DB trigger):**
- The crew "mark done" path in `app/crew/crew-content.tsx` would call the RPC instead of a
  plain `UPDATE`. If the **trigger** approach is chosen, **no client code changes** — the
  existing status update fires the trigger automatically (preferred; least surface area).

**Docs:**
- `supabase_schema.sql` — mirror the function + trigger + any new column (rule 10).
- `CLAUDE.md` — document the earn-loop trigger/RPC under the schema notes.

---

## §3 Approach + the frozen bits

**Recommended shape: a DB trigger** on `pickup_requests`, firing `AFTER UPDATE OF status`
when `NEW.status = <done>` and `OLD.status <> <done>`. A trigger (vs. an RPC the client
calls) means the earn loop can't be bypassed or forgotten by any caller, and re-writing the
same status is naturally a no-op (the `OLD <> NEW` guard). It also satisfies the CLAUDE.md
"server-side only, never write credits from the client" rule by construction.

Inside the function, in one transaction:
1. Compute `payout := COALESCE(payout_override, estimated_price)` (confirmed column names).
2. Compute `weight := <estimated_weight column>`.
3. Compute `credits := <formula>` and `co2 := weight * <CO2_FACTOR>` (see §4 for both).
4. `UPDATE profiles SET green_credits = green_credits + credits,
   kg_recycled = kg_recycled + weight, co2_saved = co2_saved + co2,
   pickups_completed = pickups_completed + 1 WHERE id = NEW.user_id`.
5. `UPDATE global_impact SET <aggregates> WHERE id = 1` (mirror the same deltas).
6. Idempotency: mark the pickup as credited (see §4) so step 1–5 never re-run for that row.

**Credits tradeoff (D1, already documented):** `green_credits` is *both* the spendable
balance and the lifetime score driving eco-levels/badges. Crediting here increases both —
which is the intended earn behavior. The dual-balance split is a separate `TODO(dual-balance)`;
A4 does **not** solve it, just feeds the existing single balance.

**Frozen — do not touch:** ML pricing (`/ml/**`, `lib/pricing.ts`, `lib/pricing-math.ts`,
`lib/estimate.ts`, `price_estimates`, the quote in `schedule-pickup-modal.tsx`). A4 reads
the *stored* payout only — it must not recompute or alter a price. Also frozen: the other
RPCs (`redeem_marketplace_item`, `log_daily_action`, `get_daily_status`,
`get_household_leaderboard`), realtime channels, Leaflet islands. Theme frozen.

---

## §4 Decision(s) needed

1. **Credit formula.** How many Green Credits per completed pickup? Options:
   (a) `credits = round(payout)` — 1 credit per ₹ of payout (simple, ties reward to real value);
   (b) `credits = round(payout * k)` for a tuning constant `k`;
   (c) per-kg: `credits = round(weight * rate)`.
   **Recommendation: (a)** `round(payout)` — transparent, needs no new tunable, and payout
   already blends weight × market value − logistics. Confirm.
2. **CO₂ factor.** `co2_saved += weight * CO2_FACTOR`. Need a single kg-CO₂-per-kg-recycled
   number (or a per-waste-type map). Recommendation: one blended constant (e.g. a documented
   `CO2_KG_PER_KG`) for demo honesty; per-type map is over-engineering for now. **User to
   supply/confirm the number.**
3. **Idempotency mechanism.** Options: (a) a boolean `credited_at timestamptz` column on
   `pickup_requests`, set inside the function, with the trigger guarded on
   `credited_at IS NULL`; (b) a separate ledger table. **Recommendation: (a)** — one column,
   reversible, and the timestamp doubles as an audit trail.
4. **Trigger vs. RPC.** Recommendation: **DB trigger** (can't be bypassed, no client change).
   Confirm you don't need the crew client to react to the credit result synchronously (the
   dashboard reads fresh columns on next load / via realtime).
5. **Which status triggers it** — the canonical "done" from A5. Recommendation: `completed`.
   Must match A5's `DONE_STATUSES`.

---

## §5 Verification

- `npx tsc --noEmit` clean (trivially, if trigger-only with no client change).
- **Idempotency test (read-only + reversible dev):** set a test pickup to `completed`, confirm
  `profiles` deltas applied once; set status to `completed` again (or update another column),
  confirm **no** second credit.
- **Correctness:** for a known pickup, verify `green_credits` increased by the formula amount,
  `kg_recycled` by weight, `pickups_completed` by 1, `co2_saved` by `weight * factor`, and
  `global_impact` moved by the same deltas.
- **Downstream:** after one completed pickup, `pickups_completed >= 1` unlocks the marketplace
  gate and badge b1 computes as unlocked (`lib/badges.ts`).
- **Frozen check:** confirm no file under `/ml`, no pricing lib, and the modal quote are
  touched; the payout is read, never recomputed.
- Mirror verified into `supabase_schema.sql`; update `CLAUDE.md`.

> Auth-gating: household/crew role sessions needed for the end-to-end manual check.

---

## §6 Risks

- **Double-crediting** on repeated status writes — the single biggest risk; mitigated by the
  `credited_at IS NULL` guard (§4.3). Test explicitly.
- **Wrong column names** → silent no-op or error. Mitigated by verifying `\d` output first.
- **`global_impact` RLS.** The row is RLS-ON, admin-writable; a `SECURITY DEFINER` function
  bypasses RLS safely for the rollup. Confirm the function owner has the needed rights and the
  search path is pinned (matches the existing RPC convention).
- **Reversibility.** If the formula/CO₂ factor is wrong, already-credited rows carry the wrong
  amount. Keep the migration reversible and prefer testing on a dev branch before live.
- **Coupling with A5.** If A5 isn't landed first (or "done" status disagrees), the trigger
  fires on the wrong/never-occurring status. Land A5 + A4 together.

---

## §7 Implementation order

1. Confirm A5's canonical "done" status (`completed`) and the `DONE_STATUSES` definition.
2. Verify live column names on `pickup_requests` / `profiles` / `global_impact` and the
   existing timestamp trigger.
3. Lock the three formulas/decisions in §4 with the user (credit formula, CO₂ factor,
   idempotency column, trigger-vs-RPC).
4. Write the `SECURITY DEFINER` function + `credited_at` column + trigger as one migration on a
   **dev branch**; test idempotency + correctness read-only.
5. Verify downstream unlocks (marketplace gate, badge b1).
6. Apply to live only after user approval; mirror into `supabase_schema.sql` + `CLAUDE.md`.
