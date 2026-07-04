# T3_B2_SPEC — Plot scheduled pickups on the crew route map

> Tier 3 build spec. Implemented in the VS Code Claude Code extension ("Fable").
> **Specs only — no code/DB changes until the user approves.**

---

## §0 Goal & non-goals

**Goal.** Scheduled pickups should appear as stops on the crew route map. Give each new
pickup a latitude/longitude at insert time (the sector centre), stop the crew view from
silently discarding coordinate-less pickups, and set the route depot from the crew's own
zone instead of an arbitrary first pickup.

**Non-goals.**
- **Do not touch the Leaflet map component** (`components/maps/OptimizedRouteMap`) or the
  ML quote inside the same modal (frozen).
- No real geocoding service / per-address precision — sector-centre coordinates are enough
  for the demo route line. No change to the route-optimization algorithm itself beyond
  feeding it the now-present coordinates and honest counts.
- Not solving the known `TODO(distance-matrix)` — B2 is adjacent to it, not it.

---

## §1 Verified current state (from audit; re-confirm before building)

- **`components/dashboard/schedule-pickup-modal.tsx`** — the pickup `insert` writes **no**
  `latitude` / `longitude`. (The modal also contains the frozen ML quote — leave that alone.)
- **`app/crew/crew-content.tsx`** — drops pickups with no coordinates **before** route
  optimization, and does so **silently**: they are not even counted in `route.deferred`, so
  the crew sees no signal that stops went missing.
- **Depot** is keyed off `pickups[0]` (whatever pickup happens to be first) rather than the
  crew member's operating zone.
- **`SECTOR_DEPOTS`** — a constant of sector-centre coordinates **already exists** (confirm
  its location/name; likely `lib/constants.ts` alongside `OPERATIONAL_SECTORS`).
- **`profiles.operating_zone`** (or equivalent) — the crew member's zone; confirm the exact
  live column name feeding the crew view.

> ⚠️ **Implementer must confirm**: the `pickup_requests` table has `latitude`/`longitude`
> columns (nullable) — if not, adding them is part of this spec; the exact `SECTOR_DEPOTS`
> shape; and the crew zone column name. Read both files + `\d pickup_requests` first.

---

## §2 Files / DB touched

**Code:**
- `components/dashboard/schedule-pickup-modal.tsx` — on insert, look up the chosen sector's
  centre from `SECTOR_DEPOTS` and write `latitude`/`longitude`. (Touch only the insert
  payload — **not** the quote block.)
- `app/crew/crew-content.tsx` — (a) count coordinate-less pickups and surface "N stops
  without coordinates" beside the existing deferred notice; (b) set depot from the crew's
  `operating_zone` via `SECTOR_DEPOTS` rather than `pickups[0]`.
- `lib/constants.ts` (or wherever `SECTOR_DEPOTS` lives) — no change expected; just confirm
  every `OPERATIONAL_SECTOR` has a depot entry.

**DB (only if the columns don't exist):**
- `pickup_requests.latitude` / `.longitude` (nullable numeric). If added, mirror into
  `supabase_schema.sql`.

---

## §3 Approach + the frozen bits

1. **Geocode at insert (sector centre).** In the modal insert, map the selected sector →
   `SECTOR_DEPOTS[sector]` centre and include `latitude`/`longitude` in the insert payload.
   Every operational sector must have an entry; guard the lookup so an unmapped sector
   doesn't insert nulls silently.
2. **Backfill note.** Existing rows have null coordinates and will still be deferred — that's
   expected and now *visible* (see step 3). Optionally a one-off backfill `UPDATE` sets
   coordinates from `location` for old rows (offer as a decision, §4).
3. **Surface the deferred count.** In `crew-content.tsx`, instead of silently filtering, count
   coordinate-less pickups and render "N stops without coordinates" next to the existing
   `route.deferred` messaging. No stop should disappear without a number.
4. **Depot from zone.** Derive the depot from `profile.operating_zone` → `SECTOR_DEPOTS`,
   falling back gracefully if the zone is unset, instead of `pickups[0]`.

**Frozen — do not touch:** `OptimizedRouteMap` (the Leaflet island — it must never render
server-side and its internals stay put); the ML quote in the modal; the realtime channels
and crew GPS gating (`isJoined === SUBSCRIBED`). Theme frozen; reduced-motion respected;
server/client split preserved (the modal/crew view are the existing client components).

---

## §4 Decision(s) needed

1. **Coordinate storage.** Confirm whether `pickup_requests` already has `latitude`/`longitude`
   columns. If **not**, approve adding them (nullable numeric). Recommendation: add them —
   the map needs real columns, not a derived-at-read hack.
2. **Sector-centre precision is acceptable for the demo?** All stops in a sector share one
   point, so the route line is sector-level, not door-level. Recommendation: **yes** for the
   final-year demo; door-level geocoding is out of scope.
3. **Backfill old pickups?** Run a one-off `UPDATE` to set coordinates from `location` for
   existing rows so they stop being deferred, or leave them deferred (now visibly counted)?
   Recommendation: **backfill** — a cleaner demo, and it's a reversible one-liner.
4. **Depot fallback** when a crew member's `operating_zone` is null — pick a default sector,
   or omit the depot? Recommendation: default to the first operational sector with a logged
   warning.

---

## §5 Verification

- `npx tsc --noEmit` clean.
- **Insert path (household role):** schedule a pickup in each sector; confirm the inserted row
  has non-null `latitude`/`longitude` matching `SECTOR_DEPOTS`.
- **Crew view (crew role, manual — Leaflet can't be driven headlessly):** new pickups appear
  as stops; the depot sits at the crew's zone centre; the "N stops without coordinates" count
  matches the number of legacy null-coordinate rows (0 after backfill).
- **Frozen check:** diff shows no change inside `OptimizedRouteMap`, the modal quote block, or
  the realtime/GPS code.
- Reduced-motion: no new animation introduced; confirm.
- If columns were added, mirror into `supabase_schema.sql`.

> Auth-gating: household (to schedule) + crew (to view the map) sessions; map is a manual
> dev check.

---

## §6 Risks

- **Unmapped sector** → null coordinates re-introduced silently. Mitigate with a guarded
  lookup that fails loudly (or blocks insert) if a sector has no depot entry.
- **`S:` network-drive flakiness** can corrupt a Next dev build (spurious `/login` 404). If
  the crew route 404s oddly after edits, clean-restart dev (`delete .next`) before debugging
  the code.
- **Touching the quote by accident.** The modal mixes the frozen ML quote with the insert;
  scope edits to the insert payload only and diff carefully.
- **Depot regression.** Changing depot source could shift the route for crews whose zone is
  unset — the fallback (§4.4) must be defined.

---

## §7 Implementation order

1. Read `schedule-pickup-modal.tsx` + `crew-content.tsx`; confirm `SECTOR_DEPOTS` shape, the
   crew zone column, and whether `latitude`/`longitude` columns exist.
2. (If needed) migration to add nullable `latitude`/`longitude`; mirror to schema SQL.
3. Add geocode-at-insert to the modal (insert payload only).
4. Surface the deferred/no-coordinate count + zone-based depot in `crew-content.tsx`.
5. (If approved) backfill old rows from `location`.
6. `tsc` green + manual crew-map verification.
