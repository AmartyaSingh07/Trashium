# S6 — Crew + Admin + Tracking: Build Spec (FINAL SESSION)

> **Status: SPEC FOR REVIEW.** Build in the VS Code Claude extension (see `VSCODE_HANDOFF_PROMPT.md` → S6).
> Last session. Consumes S1 primitives (set-then-to, `rise`/`interval`). **No code until approved.**
> Two Leaflet map islands are FIXED; three realtime paths are FROZEN (incl. the known `send()` warning).

---

## Mandatory rules (inherited — see `S1_BUILD_SPEC.md`)

- **Skill pipeline:** `/frontend-design` → `/gpt-taste` → `/impeccable` → `/ui-ux-pro-max` + always-on
  **`/karpathy-guidelines`**. Skip a lane where it adds nothing; one reconciliation; hard constraints win.
- **THEME FROZEN:** palette + fonts byte-identical. Hardcoded palette hex IS the palette — leave it. S6 has
  the **largest off-palette stray set** of the rehaul (operational status/action colors) — see §5.
- **Props/data flow identical**, reduced-motion honored, reuse i18n keys.
- **Above-the-fold rule:** GSAP `Reveal`/`Stagger` below-fold only; above-fold keeps CSS entrances.

---

## 0. Goal & non-goals

**Goal.** Restyle the crew dashboard, admin hub, and live-tracking view to Editorial Botanical — restyle the
chrome/panels/tables, align the operational color-coding to the earthy palette, and apply below-fold reveals
to **static** section wrappers — **without touching the Leaflet maps, the realtime data flow, or any table/
CRUD/GPS logic.**

**Explicitly NOT in S6:**
- **Leaflet map islands are FIXED** — `components/maps/OptimizedRouteMap` (crew, `ssr:false`) and
  `app/dashboard/tracking/tracking-map` (tracking, `ssr:false`). Do not restyle, wrap, or re-render them.
  Restyle the panels/containers *around* them only.
- **Realtime is FROZEN** — crew `channel.send()` GPS broadcast, tracking `channel.on("broadcast")` listener,
  admin `postgres_changes` subscription. **This includes the known `send()`→REST warning** (see
  `KNOWN_ISSUES.md` #1) — do NOT fix it here; it's a post-rehaul task.
- No change to admin table logic / marketplace-admin CRUD / order-status mutations / price-estimate rendering,
  crew accept/complete/cancel/reschedule handlers, GPS watchPosition, or the auth guards in the page.tsx files.
- No palette/font change except aligning the §5 strays. No new i18n keys for existing copy. No new deps.

---

## 1. Verified current state (scanned)

**Pages (server, auth guards — untouched):**
- `app/crew/page.tsx` — role gate (crew/collector/admin), fetches zone pickups → `CrewDashboardContent`.
  **Note: crew renders NO Navbar/Footer** (returns the content directly) — S3 chrome doesn't apply here.
- `app/admin/page.tsx` — fetches price_estimates, marketplace_items, orders, users, badges; Navbar/Footer.
- `app/dashboard/tracking/page.tsx` — fetches profile/zone → `TrackingContent` (no Navbar/Footer).

**Content components:**
| File | Type | Map island | Realtime | Tables | Notes |
|---|---|---|---|---|---|
| `app/crew/crew-content.tsx` (~490 ln) | client | `OptimizedRouteMap` (L269, fixed) | `channel.send()` GPS broadcast (L90–114, frozen) | pickups table (L293) | action modal (accept/complete/cancel), pending banner |
| `app/admin/admin-content.tsx` (~510+ ln) | client | none | `postgres_changes` sub (L144, frozen) | price table (L392), orders table w/ sticky thead (L482) | + `components/admin/marketplace-admin.tsx` CRUD |
| `app/dashboard/tracking/tracking-content.tsx` | client | `TrackingMap` (L132, fixed) | `channel.on("broadcast")` listener (L44, frozen) | — | full-screen map + overlay cards (`animate-fade-up`) |

**Counters:** none (`CountUp`/`AnimatedNumber` absent). No counter migration needed in S6. (Crew `pendingCount`
is a raw stat — optional animate, low value, default leave — count-up on operational stats is distracting.)

**Off-palette strays (largest set — all semantic status/action colors):**
- **Crew:** `bg-amber-600` broadcast banner (L210); `text-amber-700` pending (L251,281); status badges
  emerald/blue/red/amber (L321–325); `hover:text-red-600` (L454); action buttons `bg-blue-600` accept (L463),
  `bg-emerald-600` complete (L477), `bg-red-50 text-red-700` cancel (L484).
- **Admin:** price/stat cells `text-emerald-700`/`text-amber-700` (L408,419,430,453,457); alert badge
  `bg-red-50 text-red-700 animate-pulse` (L507).
- **Tracking:** disconnected state `border-amber-300 text-amber-700` (L144); status dot `bg-amber-500`
  (L150,155).
See §5.

---

## 2. Files touched in S6

**MODIFY (restyle only):**
```
app/crew/crew-content.tsx                  panels/table/modal/banner restyle; §5 action+status colors;
                                           .t-lift/.t-focus-ring. Map, GPS send(), accept/complete/cancel FROZEN.
app/admin/admin-content.tsx                table/panel restyle; §5 cell/alert colors; Reveal static panels.
                                           postgres_changes sub + all mutations FROZEN.
components/admin/marketplace-admin.tsx      CRUD form chrome restyle; .t-focus-ring. Create/edit/award logic FROZEN.
app/dashboard/tracking/tracking-content.tsx  overlay-card restyle; §5 connection colors; botanical ease.
                                           TrackingMap + realtime listener FROZEN.
```
**Do NOT touch:** the three `page.tsx` files, `components/maps/*`, `tracking-map.tsx`, any `.channel/.send/
.on/postgres_changes`, `watchPosition`, table data logic, CRUD/order-status mutations, `lib/*`, `/ml`.

---

## 3. Map islands + realtime — the S6 tripwires

- **Leaflet islands stay byte-fixed:** `OptimizedRouteMap` and `TrackingMap` are `dynamic(..., {ssr:false})`
  client islands. Do not restyle their internals, change their props, or wrap them in a motion primitive
  (a `Reveal` around a map would set `opacity:0` then reflow the map canvas — breaks tiles). Restyle only the
  **container panel** around each (border, padding, header), leaving the map element's box untouched.
- **Realtime frozen:** the GPS `send()`, the broadcast listener, and the admin `postgres_changes` subscription
  are logic — untouched. **The `send()`→REST deprecation warning stays** (KNOWN_ISSUES.md #1, post-rehaul).

---

## 4. Motion — DON'T animate live-updating content (S6-specific guardrail)

Crew/admin/tracking are **operational, realtime** surfaces. Motion goes on **static** wrappers/headers only:
- **Do NOT `<Stagger>` table rows** — admin order/price rows update via `postgres_changes`; a realtime insert/
  update would re-fire or fight the stagger. `<Reveal>` the **panel/section wrapper** instead (one static
  element), never the dynamic row list.
- **Do NOT wrap the map or its overlay cards in `<Reveal>`** — tracking overlays update from live telemetry;
  keep their existing `animate-fade-up` (upgrade to botanical ease at most).
- **Crew pending banner / GPS status** — live state; keep CSS, don't scroll-reveal.
- **OK to `<Reveal>`:** a static section header, a whole table *panel* as a single unit (revealed once on first
  scroll), the admin marketplace-admin form card. Operational content should be immediately visible — favor
  subtle single reveals over heavy staggering. Don't over-animate a control surface.

Above-the-fold operational content (crew header/stats, admin top table, tracking map) stays immediately visible
— no hidden-first state.

---

## 5. Off-palette strays — the big taste call (align operational colors to palette)

S6 has the most off-palette color, and it's all **semantic**: action buttons (accept/complete/cancel),
status badges (pending/accepted/completed/cancelled), connection state (connected/disconnected), admin
stat cells (good/pending/alert). The palette has no blue — so `bg-blue-600` "accept" needs a palette substitute.

**Recommended mapping (earthy, preserves distinguishability) — taste-pass finalizes + records it:**
| Meaning | Current (off-palette) | → Earthy palette |
|---|---|---|
| Primary action / "accept" | `bg-blue-600` | `bg-terra text-linen` (primary action) |
| Success / "complete" / done / connected | `bg-emerald-600`, `text-emerald-700` | `bg-sage-deep`/`text-moss` (or `.status-completed` tone) |
| Pending / warning / disconnected | `amber-600/700/500` | `amber-warm` / `clay` (`.status-pending` tone) |
| Cancel / error / alert | `bg-red-*`, `text-red-*` | `--destructive` (palette's own brick red) |
| In-progress / "accepted" badge | `bg-blue-50 text-blue-700` | `sage`/`clay` tint (must stay distinct from complete) |

**Hard requirement:** operational color-coding must remain **visually distinguishable** — accept vs complete
vs cancel, connected vs disconnected must not collapse into the same tone. This is the largest *visible* change
of the rehaul, so it's the taste-pass's deliberate call; record the final mapping in the checkpoint. Default:
align (consistent with S3/S4/S5 stray fixes). Everything `#RRGGBB` is palette — leave.

---

## 6. i18n

Reuse the crew/admin/tracking namespaces exactly. No new keys for existing copy.

---

## 7. Verification (S6 gate)

1. **`npx tsc --noEmit` FULLY clean** (it is now — keep it there).
2. **All three are auth-gated by role** — Playwright/manual needs: a **crew/collector** session for `/crew`, an
   **admin** for `/admin`, any household for `/dashboard/tracking`. Crew also needs **GPS permission** for the
   broadcast. Automated coverage is limited (realtime + geolocation + Leaflet) — verify on dev with real
   sessions and note it.
3. **Maps still render** — `/crew` route map and `/dashboard/tracking` map draw tiles and markers; panels
   around them restyled, map boxes unchanged (no broken tiles / zero-height canvas).
4. **Realtime still flows** — crew broadcasts (the `send()`→REST warning still logs, unchanged & expected);
   tracking receives telemetry pings; admin table updates live on a `pickup_requests` change. Restyle didn't
   detach any subscription.
5. **Operational actions work** — crew accept/complete/cancel/reschedule; admin order-status changes +
   marketplace-admin create/edit/award. Logic untouched.
6. **Color-coding legible** — the §5 remap keeps accept/complete/cancel and connected/disconnected distinct.
7. **No CLS; reduced-motion** — panels visible, maps intact, no stranded reveals.
8. **Skill pipeline** + one reconciliation; record the §5 mapping. **This is the last session — after it, the
   rehaul (S1–S6) is complete.**

---

## 8. Risk register

| Risk | Mitigation |
|---|---|
| Reveal wraps a Leaflet map → broken tiles / zero-height canvas | Never wrap maps in motion; restyle the container panel only, map box untouched. |
| Staggering realtime rows fights live updates | Reveal the static panel wrapper, never the dynamic row list. |
| Realtime subscription detached during restyle | Don't touch `.channel/.send/.on/postgres_changes`; §7.4 smoke test. |
| Someone "fixes" the send()→REST warning here | Out of scope — KNOWN_ISSUES.md #1, post-rehaul only. |
| Operational colors collapse into indistinguishable tones | §5 hard requirement: preserve distinguishability; taste-pass records the mapping. |
| Crew has no Navbar/Footer — assumed chrome missing | Crew is self-contained; don't add chrome, restyle in place. |
| CRUD/GPS/table logic touched | Restyle chrome only; all handlers + subscriptions frozen. |
| Auth+GPS+Leaflet block automated tests | Verify manually per role on dev; note coverage limits in report. |

---

## 9. Implementation order (once approved)
0. `/frontend-design` for the panel/table rhythm + the §5 color mapping within frozen tokens.
1. `tracking-content.tsx` — overlay-card restyle + §5 connection colors + botanical ease; map + listener frozen.
   (Smallest; validates the "restyle around a fixed map" pattern.)
2. `crew-content.tsx` — panels/table/modal/banner restyle + §5 action/status colors + `.t-lift`/`.t-focus-ring`;
   map, GPS send(), accept/complete/cancel frozen. (No Navbar/Footer here.)
3. `admin-content.tsx` + `marketplace-admin.tsx` — table/panel/form restyle + §5 cell/alert colors; `<Reveal>`
   static panels (NOT rows); postgres_changes + mutations frozen.
4. `npx tsc --noEmit` (stay fully clean) → per-role manual/authed checks → maps render → realtime flows →
   operational actions work → color-coding legible → reduced-motion/no-CLS.
5. Hand off to VS Code skills: `/gpt-taste` → `/impeccable` → `/ui-ux-pro-max` + `/karpathy-guidelines`; one reconciliation.

**Restyle around the fixed maps and the live data; change only presentation. After S6, the rehaul is done —
then surface the post-rehaul `KNOWN_ISSUES.md` #1 realtime follow-up.**
