# T3_B2 — Build handoff: plot scheduled pickups on the crew route map

> Verified live this session. Locked to recommended decisions. Code → Fable (paste §3).
> One optional DB backfill waits for the user's "apply".

---

## §0 Live facts verified

- **`pickup_requests.latitude` / `.longitude`** already exist (numeric, nullable). **No column
  migration needed.**
- **`SECTOR_DEPOTS`** (`lib/constants.ts:54-60`) is `Record<string,{lat,lng}>` with keys exactly
  matching `OPERATIONAL_SECTORS` — `Rishra, Howrah, Shyamnagar, Tarakeswar, Hugli-Chinsura` —
  which is what `pickup_requests.location` stores. So `SECTOR_DEPOTS[location]` resolves cleanly.
- **`schedule-pickup-modal.tsx:150-163`** insert payload writes `location` but **no**
  `latitude`/`longitude`. (The ML quote is computed just above at L146-148 — **frozen, do not touch**.)
- **`crew-content.tsx`:**
  - L197 filters `p.latitude != null && p.longitude != null` → coordinate-less pickups are
    dropped **silently** (they are not in `route.deferred`).
  - L207 `const depot = SECTOR_DEPOTS[pickups[0]?.operating_zone] ?? undefined;` → depot keyed off
    the **first pickup**, not the crew's own zone.
  - L288-290 renders only `route.deferred.length` (capacity/stop-limit), never the dropped
    coordinate-less count.
  - L53 already uses `"Howrah"` as the crew's default sector when `operating_zone` is unset.

---

## §1 Locked decisions (recommended)

1. **Geocode at insert to sector centre** via `SECTOR_DEPOTS[form.location]`. Sector-level
   precision is accepted for the demo.
2. **Depot from the crew's own zone** (`profile.operating_zone`), falling back to `"Howrah"`
   (matches the existing L53 default) when unset.
3. **Surface the coordinate-less count** next to the deferred notice — no stop disappears silently.
4. **Backfill existing rows** from `location` so old pickups plot too (optional DB write, §4).

---

## §2 Files / DB touched

- `components/dashboard/schedule-pickup-modal.tsx` — add lat/lng to the insert payload (only).
- `app/crew/crew-content.tsx` — depot from `profile.operating_zone`; count + surface
  coordinate-less pickups.
- DB (optional, user-approved): one-off backfill `UPDATE` — no schema change.

---

## §3 Fable prompt (paste into the VS Code extension)

> Context: Trashium (Next.js 16 / React 19). Do NOT touch the ML quote in the modal, the
> `OptimizedRouteMap` Leaflet component, the realtime/GPS code, or the theme. Keep
> `npx tsc --noEmit` green. `SECTOR_DEPOTS` is imported from `@/lib/constants` (already imported
> in crew-content; add the import in the modal if missing).

**1. `components/dashboard/schedule-pickup-modal.tsx` (insert at L150-163)** — add sector-centre
coordinates to the insert object, without touching the quote logic above it:
```ts
import { SECTOR_DEPOTS } from "@/lib/constants"; // if not already imported
// …inside the insert payload, alongside `location: form.location`:
const depot = SECTOR_DEPOTS[form.location];
// add these two keys to the .insert({...}) object:
latitude:  depot?.lat ?? null,
longitude: depot?.lng ?? null,
```
(If `form.location` is somehow not a known sector, the pickup still inserts with null
coordinates and is safely handled by the crew view's coordinate-less path below.)

**2. `app/crew/crew-content.tsx`**
- **Depot (L207):** replace
  `const depot = SECTOR_DEPOTS[pickups[0]?.operating_zone] ?? undefined;`
  with
  `const depot = SECTOR_DEPOTS[profile.operating_zone ?? "Howrah"] ?? SECTOR_DEPOTS["Howrah"];`
- **Coordinate-less count:** where `stops` is derived (L197), also compute
  `const missingCoords = pickups.filter(p => p.latitude == null || p.longitude == null).length;`
- **Surface it (near L288-290):** next to the existing deferred banner, render when
  `missingCoords > 0`: e.g. `⚠️ {missingCoords} stop(s) without map coordinates (not routed).`
  Use the existing banner styling/tokens — no new colors.

**Verify:** `npx tsc --noEmit` clean; schedule a pickup in each sector and confirm the row gets
non-null lat/lng; crew map shows new stops with the depot at the crew's zone; the coordinate-less
count matches legacy null rows.

---

## §4 Optional DB backfill (apply from chat after user approval — reversible)

```sql
UPDATE public.pickup_requests p
SET latitude  = d.lat,
    longitude = d.lng
FROM (VALUES
  ('Rishra',22.7102,88.3204),('Howrah',22.5958,88.2636),
  ('Shyamnagar',22.8271,88.3768),('Tarakeswar',22.8872,88.0163),
  ('Hugli-Chinsura',22.9079,88.3912)
) AS d(location,lat,lng)
WHERE p.location = d.location
  AND (p.latitude IS NULL OR p.longitude IS NULL);
```
> Reversible (set the touched rows back to NULL). Values mirror `SECTOR_DEPOTS`. After this,
> legacy pickups plot and the coordinate-less count drops to 0.

---

## §5 Risks

- **Unmapped `location`** → null coords (safe: handled by the coordinate-less path). All current
  sectors are mapped.
- **`S:` drive flakiness** can corrupt a Next dev build (spurious `/login` 404) — clean-restart
  dev (`delete .next`) if crew routes 404 oddly after edits.
- **Depot regression** for crews with unset zone — the `"Howrah"` fallback covers it.
- Frozen: keep edits off the modal quote, the Leaflet component, and realtime/GPS.
