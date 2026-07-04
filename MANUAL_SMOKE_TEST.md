# Trashium — Role-by-Role Smoke Test

> Manual dry-run before the live demo. Covers the flows that **can't** be verified headlessly
> (auth-gated pages, realtime, GPS, Leaflet) and focuses on this session's changes (A4 earn loop,
> A5 status vocabulary, B2 geocoding, B5 admin table, B6 incident/offline) plus core paths.
> `[ ]` = to check · **Watch:** = the specific thing most likely to regress.
> To confirm DB values, ask me to run a read-only query on project `fqbjjcbrxrokvdwkydze`.

---

## 0. Preconditions

- [ ] `npm run dev` up on localhost:3000; if any route 404s oddly, delete `.next` and restart (flaky `S:`).
- [ ] Three test accounts ready: **household**, **collector (crew)**, **admin**.
- [ ] `npx tsc --noEmit` clean and `npm run lint` exits 0 (should already be true — commit `fd137398`).
- [ ] Know one household's starting `green_credits` / `pickups_completed` (ask me to query) so you can
      confirm the earn-loop delta later.

---

## 1. Auth & routing (all roles)

- [ ] Logged out, visiting `/dashboard`, `/crew`, `/admin` each redirects to `/login`.
- [ ] Household login lands on `/dashboard`; visiting `/crew` or `/admin` redirects to their own area.
- [ ] Collector login lands on `/crew`; `/dashboard` / `/admin` redirect away.
- [ ] Admin login lands on `/admin`; other role pages redirect away.
- **Watch:** no infinite redirect loop; navbar collapses to icons below xl without overlap.

---

## 2. Household — dashboard & scheduling

- [ ] `/dashboard` renders: credits, kg, CO₂, pickups count, impact cards, recent pickups.
- [ ] **Schedule a pickup** (each sector at least once across the pass): pick a sector, waste items,
      weight, date/time slot → submit succeeds, toast shown, pickup appears as **pending**.
- [ ] Recent-pickups shows the new row; action buttons appear only for **pending/accepted**.
- **Watch (B2):** the new row silently gets `latitude`/`longitude` = its sector centre — ask me to
      query the row to confirm they're non-null.
- **Watch (A5):** status label reads a canonical value (never "confirmed"/"processed").
- **Watch:** ₹ amounts render without thousands grouping; credits keep grouping (NumberFlow).

## 3. Household — profile & marketplace

- [ ] `/profile` renders name, eco-level, credits, kg, CO₂; editing + saving a field **persists**
      after refresh (A3).
- [ ] `/marketplace` gate: only reachable with `green_credits ≥ 500` **and** `pickups_completed ≥ 1`.
- [ ] Redeem an affordable item → credits deduct once, order shows in "My Redemptions" as **pending**.
- **Watch:** redemption goes through the RPC (no client-side credit math); no double-deduct.

## 4. Household — daily ritual (streaks/quiz)

- [ ] Daily check-in / segregate / quiz widgets respond; credits update from the RPC result only.
- [ ] Quiz wrong answer registers a **strike** (`quiz_strike`), correct answer credits.
- **Watch:** streak multiplier, shields, milestone chest all come from `log_daily_action` (server),
      never written from the client.

---

## 5. Collector (crew) — route map & GPS

- [ ] `/crew` renders assigned pickups + the **OptimizedRouteMap** (Leaflet) with plotted stops.
- **Watch (B2):** stops actually appear on the map; the **depot** sits at the crew's own operating
      zone (not a random pickup); the "⚠️ N stop(s) without map coordinates" line shows **0** (legacy
      rows were backfilled) — or matches any brand-new coordinate-less rows.
- [ ] Deferred banner (capacity/stop-limit) still behaves for large runs.
- [ ] Enable location → GPS telemetry broadcasts (realtime) only once joined/`SUBSCRIBED`.

## 6. Collector — status advancement (A5 + A4)

- [ ] Advance a pickup pending → accepted → collected → completed via the crew action modal; each
      persists and the badge updates.
- **Watch (A4 — the big one):** when a pickup hits **completed**, that household's
      `green_credits += round(payout)`, `kg_recycled += weight`, `co2_saved += weight×1.05`,
      `pickups_completed += 1`, and `global_impact.total_*` move. Ask me to query before/after.
- **Watch (idempotency):** re-saving an already-completed pickup does **not** credit again.
- **Watch (A5):** the status dropdown offers only the canonical five; no write is rejected.

## 7. Collector — incident report & offline (B6)

- [ ] Open a pickup → submit an incident report → success toast **only after** it saves; ask me to
      query that pickup's `notes` and confirm a `[INCIDENT <timestamp>] …` line was appended.
- [ ] A second report on the same pickup **appends** (doesn't overwrite the first / the household's notes).
- [ ] Toggle DevTools → **Offline**: the banner reads "OFFLINE — actions are blocked until you
      reconnect" (no "cached mutations" fiction), and a status update / report is actually **blocked**.
- [ ] Back online → actions work again.

---

## 8. Admin — pickup management (B5 + A5)

- [ ] `/admin` renders; the **Pickup Management** table shows below the Operations Live Monitoring Stream.
- [ ] The status filter narrows rows; the search box filters by household/sector/waste.
- [ ] A per-row status **Select** changes a pickup's status → persists (refresh) and the row updates.
- **Watch (A4 cross-effect):** setting a **not-yet-completed** pickup to `completed` from here credits
      the household via the same trigger (test with a fresh pickup, not an already-completed one).
- [ ] On first load, a skeleton shows briefly; empty filter result shows the empty-state row.
- **Watch (reduced-motion):** with OS "reduce motion" on, the skeleton pulse is disabled.

## 9. Admin — monitoring stream & CSV (A5)

- [ ] Operations Live Monitoring Stream lists pickups; **completed** rows show an "Actual Collection"
      time (not "Awaiting Crew…").
- [ ] Export Summary CSV: the **Completed Pickups** column is now non-zero (counts `completed`, not
      the old phantom `processed`).
- [ ] Marketplace admin: catalog CRUD, advance an order pending → dispatched → delivered, award a
      manual badge — all persist.

---

## 10. End-to-end earn loop (the headline demo path)

Do this as one continuous flow across two accounts:

1. [ ] As **household**: note starting credits/kg/pickups (ask me to query), schedule a pickup with a
       known weight.
2. [ ] As **collector**: accept → collect → **complete** that pickup.
3. [ ] As **household** again: refresh `/dashboard` → credits/kg/CO₂/pickups increased by exactly the
       expected deltas; impact cards reflect it.
4. [ ] If the household crossed 500 credits + has ≥1 pickup, the **marketplace unlocks**; a new badge
       (e.g. b1 "first pickup") may light up.
- **Watch:** the delta is credited **once**, matches `round(payout)` / `weight` / `weight×1.05`, and
      the pre-existing seeded 48 completed rows were **not** retro-credited.

---

## 11. Cross-cutting regression sweep

- [ ] Toggle language en → hi → bn: strings switch (incl. the new B6 offline/report copy), no raw keys.
- [ ] OS reduced-motion on: Ribbons/flames/count-ups/skeletons don't animate or thrash.
- [ ] No console errors on any role's main page.
- [ ] Theme intact — warm earth tones, correct fonts (Cormorant/Syne/DM Sans/JetBrains Mono).

---

### If something fails
Tell me the role + step number and what you saw. I'll read the real code/query the DB and diagnose,
then spec a fix for Fable (or, if it's a DB issue, propose a reversible migration for your approval).
