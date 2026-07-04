# T3_B5 — Build handoff: restore the admin pickup-management table

> Decision: **Restore** (user-confirmed). Verified live this session. Code → Fable (paste §3).
> No DB migration. Depends on A5 (done) — the status dropdown uses the canonical vocabulary.

---

## §0 Live facts verified

- `app/admin/admin-content.tsx` already **imports every primitive needed** and none are rendered
  by the management feature yet: `Table/TableBody/TableCell/TableHead/TableHeader/TableRow`
  (L17-24), `Select/SelectContent/SelectItem/SelectTrigger/SelectValue` (L10-16),
  `DropdownMenu*` (L25-30), `MoreHorizontal` (L37), `Button`, `Input`, `Badge`, `StatusBadge`.
- **Orphaned, ready to wire:** `loading` state (L92, initial `true`), `statusFilter` (L93) +
  `handleStatusFilterChange` (L214), the `filtered` list (L258, already applies `statusFilter` +
  `searchTerm`), and `handleStatusUpdate` (L269 — now a clean canonical pass-through post-A5).
- A separate **read-only** "Operations Live Monitoring Stream" table already renders at
  L457-534 (raw `<table>`). The restored feature is the **interactive** one (row status control +
  filter), distinct from that monitor.
- `OPERATIONAL_SECTORS` and the theme tokens are already in use in this file — reuse them.

---

## §1 What to build

An **admin pickup-management** section (a `Card`, placed sensibly in the admin grid — suggest
directly below the "Operations Live Monitoring Stream" block, ~after L534) that:
1. Renders the `filtered` pickups in the `Table` primitive.
2. Per row: name/location/waste_type/weight/status + a **status control** (`Select`) whose
   options are the **canonical five** and which calls `handleStatusUpdate(p.id, value)`.
3. A **status filter** `Select` bound to `statusFilter` / `handleStatusFilterChange` (options:
   `all` + the five), reusing the existing `searchTerm` `Input`.
4. A **loading skeleton** while `loading` is true (a few placeholder rows), so the L92 state is
   finally surfaced.

---

## §2 Files touched

- `app/admin/admin-content.tsx` only. No DB, no schema, no new imports.

---

## §3 Fable prompt (paste into the VS Code extension)

> Context: Trashium (Next.js 16 / React 19). Restore the orphaned admin pickup-management table.
> All UI primitives are already imported. Do NOT touch ML pricing, RPCs, realtime, Leaflet, or the
> theme — use the existing `components/ui` primitives and the Card/token styling already in this
> file. Keep `npx tsc --noEmit` green and `handleStatusUpdate` as-is (canonical pass-through).

Build a new `Card` section titled e.g. "Pickup Management" below the "Operations Live Monitoring
Stream" block:

- **Filter bar:** the existing `searchTerm` `Input`, plus a `Select` bound to `statusFilter` via
  `handleStatusFilterChange`, with items:
  `all, pending, accepted, collected, completed, cancelled`.
- **Table** (using `Table/TableHeader/TableRow/TableHead/TableBody/TableCell`) over `filtered`,
  columns: Household (`p.profiles?.full_name ?? p.full_name`), Sector (`p.location`), Waste
  (`p.waste_type`), Weight (`p.estimated_weight` kg), Status (render `StatusBadge`), and an
  **Action** cell.
- **Action cell:** a `Select` (or `DropdownMenu` with `MoreHorizontal`) whose options are the
  canonical five statuses; on change call `handleStatusUpdate(p.id, value as PickupStatus)`.
  The status dropdown must offer **only** `pending | accepted | collected | completed | cancelled`
  — anything else is rejected by the A5 CHECK constraint.
- **Loading state:** when `loading` is true, render ~4 skeleton rows (simple pulse placeholders,
  reduced-motion safe) instead of the table body; otherwise render `filtered`. If `filtered` is
  empty and not loading, show an empty-state row.
- Respect `prefers-reduced-motion` on the skeleton pulse.

**Verify:** `npx tsc --noEmit` clean; `npm run lint` shows no NEW unused-import warnings for
`Table`/`Select`/`DropdownMenu`/`MoreHorizontal`; the table renders and filters; changing a row's
status persists (network) and updates the row; the skeleton shows on initial load.

---

## §4 Cross-effects & risks

- **A4 earn loop:** an admin setting a pickup to `completed` fires `tr_apply_pickup_completion`
  and credits the household — desired and idempotent (won't double-credit). Setting an already
  `completed` pickup to another status does **not** un-credit (no reversal logic — acceptable for
  the demo; flag if you want reversal later).
- **A5 CHECK:** the dropdown must not offer phantom statuses — enforced above.
- **Theme:** use existing primitives + tokens only; no new colors/fonts.
- **RLS:** admin page is already role-gated (A1, done); writes use the existing browser client.
