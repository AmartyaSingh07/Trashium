# T3_B5_SPEC — Resolve the orphaned admin pickup-management table

> Tier 3 build spec. Implemented in the VS Code Claude Code extension ("Fable").
> **Specs only — no code/DB changes until the user approves.**

---

## §0 Goal & non-goals

**Goal.** Resolve dead code in `app/admin/admin-content.tsx`: a full pickup-management
feature (`handleStatusUpdate`, `statusFilter` state, the filtered list, and the
`Table` / `DropdownMenu` / `Select` imports) is defined but **never rendered**. Either
**restore** the management table into the JSX so admins can advance/cancel pickups from the
hub, or **delete** the dead code. Also: a `loading` state is set but never rendered — wire a
skeleton (only relevant if we restore).

**Non-goals.**
- No new admin capabilities beyond what the existing (orphaned) handler already implements.
- No status-transition logic redesign — if restored, the dropdown uses the **A5** vocabulary,
  nothing more.
- No RLS changes (admin server role-gate A1 is already done).

---

## §1 Verified current state (from audit; re-confirm before building)

- **`app/admin/admin-content.tsx`** defines `handleStatusUpdate`, `statusFilter`, the derived
  filtered pickup list, and imports `Table` / `DropdownMenu` / `Select` — **none rendered**
  in the returned JSX. The handler + filter state are **intact** (so restoration is low-risk).
- A **`loading`** state is set but never surfaced in the UI.
- The audit could **not** attribute this to the presentation rehaul — there's no pre-rehaul
  commit to diff, so it's unclear whether the table was ever wired. Treat it as a genuine
  product decision, not a regression to revert.
- Today only the **crew** can advance a pickup's status; the admin hub cannot.

> ⚠️ **Implementer must read `admin-content.tsx` in full first** — confirm the exact names of
> the orphaned handler/state/imports and where in the JSX a restored table would slot
> (relative to the existing admin sections). Verify `handleStatusUpdate`'s write path uses the
> correct Supabase **browser** client and respects the admin gate.

---

## §2 Files / DB touched

**Code (one file):**
- `app/admin/admin-content.tsx` — either (Restore) render the table + status dropdown +
  filter + loading skeleton, or (Delete) remove the handler, state, filtered list, and now-unused
  imports.

**No DB changes.** (Status writes go through the existing update path; if A4 lands a
completion trigger, an admin setting a pickup to `completed` will *also* fire the earn loop —
noted as a cross-effect in §6, not a change here.)

**Docs:** none required unless behavior is documented in `CLAUDE.md` (optional).

---

## §3 Approach + the frozen bits

**If Restore (recommended):**
1. Render the pickup-management table in the admin JSX using the already-defined filtered list
   and the `Table` primitive.
2. Wire the per-row status control (`DropdownMenu`/`Select`) to `handleStatusUpdate`, with the
   options constrained to the **A5 canonical set** (`pending / accepted / collected /
   completed / cancelled`). Depend on A5 landing first (or gate this behind it).
3. Wire `statusFilter` to actually filter the rendered list.
4. Render a skeleton/spinner when `loading` is true.
5. Confirm the write uses the correct client and the admin role-gate (A1) still guards the page.

**If Delete:**
1. Remove `handleStatusUpdate`, `statusFilter`, the filtered list, and the unused
   `Table`/`DropdownMenu`/`Select` imports. Leave the `loading` state only if something else
   uses it; otherwise remove it too.

**Frozen — do not touch:** ML pricing/quote; the RPCs; realtime; Leaflet islands. Theme
frozen (any restored table must use existing `components/ui/` primitives + tokens — no new
colors/fonts). Reduced-motion respected on the skeleton. Server/client split preserved
(`admin-content.tsx` is the client component; the server `page.tsx` keeps the auth guard).

---

## §4 Decision(s) needed

1. **Restore or delete?** Recommendation: **Restore** — the handler + filter are intact, it
   gives the admin hub a real capability for the demo, and it removes the "defined-but-dead"
   smell honestly. Delete only if the admin is intentionally read-only.
2. **If restored — status options.** Confirm the dropdown offers the full A5 set, or a
   restricted subset (e.g. admin may only `cancel`, not advance). Recommendation: full set,
   since the handler already supports arbitrary status writes.
3. **If restored — should an admin-set `completed` fire the A4 earn loop?** Since A4 is a DB
   trigger, **yes, automatically** — an admin completing a pickup credits the household just
   like the crew doing it. Confirm that's desired (recommended: yes, consistent).

---

## §5 Verification

- `npx tsc --noEmit` clean — deleting dead code or wiring the table must not leave unused
  imports (lint) or type errors.
- **Restore path (admin role, manual):** the table renders; the status filter narrows rows;
  changing a row's status persists and re-renders; the skeleton shows while `loading`.
- **Delete path:** grep confirms no dangling references to the removed handler/state; no unused
  imports remain; `npm run lint` clean.
- **Frozen check:** no pricing/RPC/map/theme files touched; restored UI uses only existing
  `components/ui/` primitives and tokens.
- Cross-check with A4/A5: dropdown options equal the A5 set; an admin `completed` fires the A4
  trigger exactly once (idempotency owned by A4).

> Auth-gating: admin role session required; this is a manual dev check.

---

## §6 Risks

- **Ordering with A5.** If restored before A5, the dropdown could offer phantom statuses.
  Gate B5's restore on A5, or hard-code the A5 set from the start.
- **Cross-effect with A4.** A restored admin control that sets `completed` will trigger the
  earn loop — desirable but must be understood; double-crediting is prevented by A4's
  idempotency guard, not by B5.
- **Theme drift.** A hand-built table could smuggle in non-token styles. Enforce existing
  primitives + frozen tokens.
- **Deleting too much.** If `loading` or an import is shared with a rendered section, blind
  deletion breaks it — grep before removing.

---

## §7 Implementation order

1. Read `admin-content.tsx` fully; confirm the orphaned symbols and a JSX slot.
2. Decide Restore vs Delete with the user (§4.1).
3a. **Restore:** render table + filter + A5-constrained dropdown + loading skeleton; verify
    write path + admin gate.
3b. **Delete:** remove handler/state/list/imports; lint clean.
4. `tsc` + `lint` green; manual admin verification (if restored). Land after/with A5.
