# TRASHIUM — FIX AUTHORIZATION: TIER 1 (safe, code-only) + Visual/Responsive Polish

> Paste into the reviewing agent's chat. This is the **"go" for Tier 1 ONLY** — the safe, code-only
> fixes from the QA review plus the responsive/clipping issues below. Fix exactly what's listed here.
> **Do NOT touch Tier 2 (DB/RLS), Tier 3 (features), or any frozen path.**
> (If running Fable: also re-attach the 4 UI screenshots so it can see the navbar overlap + clipping.)

---

## Hard guardrails (non-negotiable — same as the QA review brief)

- Keep the site running and **`npx tsc --noEmit` green** after every change.
- **Do NOT change the ML pipeline** (`/ml`, `lib/pricing.ts`, `lib/pricing-math.ts`, `price_estimates`,
  `lib/estimate.ts`, the pickup quote), the **frozen RPCs** (`redeem_marketplace_item`, `log_daily_action`,
  `get_daily_status`, `get_household_leaderboard`), the **`profiles.update`** mutation, the **realtime
  channels**, or the **Leaflet maps**. Restyle/UI-state only where those are nearby.
- **Theme FROZEN** — use `app/globals.css` tokens (Terra `#C2703D`, Bark `#2A2218`, Sage `#8FA37E`,
  Destructive `#C0392B`, etc.); hardcoded hex equal to a token is fine, don't invent hex.
- Respect `prefers-reduced-motion`, reuse existing i18n keys, keep the server/client split.
- **Do NOT touch Tier 2/3 items** (listed at the bottom) — they're a separate, deliberate session.
- Work in small logical commits; run `tsc` per commit; report the diff. Nothing else changes.

---

## PART A — Tier 1 code-only fixes (from the QA review)

1. **A1 — Admin role gate (highest priority; security/privacy).** `app/admin/page.tsx`: after `getUser()`
   and before the `Promise.all` fetches, fetch the caller's `profiles.role` and `redirect("/dashboard")`
   unless `role === "admin"` — mirror `app/crew/page.tsx`. This stops every user's email from shipping in
   the RSC payload to non-admins. (Do NOT change the DB policies here — that's Tier 2.)
2. **B3 — Reset live-connection banners on drop.** `app/crew/crew-content.tsx` L~99–104 and
   `app/dashboard/tracking/tracking-content.tsx` L~56–60: in the existing `subscribe` callback set
   `setIsBroadcasting(status === "SUBSCRIBED")` / `setIsConnected(status === "SUBSCRIBED")` so the banner
   clears on `CLOSED`/`CHANNEL_ERROR`/`TIMED_OUT`. **State only — do not touch the channel wiring.**
3. **B7 — Quiz submit ordering.** `dashboard-content.tsx` L~190–208: move `setQuizSubmitted(true)` to AFTER
   a successful `log_daily_action`; error branch becomes a "try again" state. **Do not touch the RPC call.**
4. **B8 — Achievements effect.** `dashboard-content.tsx` L~149–157 / L~306–348: fix the stale-closure read
   of `previouslyUnlockedIds` (functional update + correct deps), memoize `achievements` (stop the per-render
   `new Date()`), so no duplicate unlock toasts. Do not add a second badge system — prefer deltas from
   `lib/badges.ts` if trivial, else just fix the closure/deps.
5. **C1 — Profile level math.** `profile-content.tsx` L~73–80: replace the hardcoded 1000-point math with
   `getNextTier(credits)` from `lib/gamification.ts` for BOTH the copy and the ring
   (`(credits - tier.minPoints)/(next.minPoints - tier.minPoints)`). (CLAUDE.md rule 6.)
6. **C2 — Profile stats from real columns.** `profile-content.tsx` L~215–218: render `profile.co2_saved`
   and `profile.kg_recycled` (already fetched) instead of the `credits × 0.42` / `× 0.1` fictions.
7. **C3 — "leaf" watermark.** `profile-content.tsx` L~141–143: the `text-[40rem]` literal word "leaf" →
   use `BotanicalSVG` (as on the auth pages) or remove.
8. **C5 — Dead `hero-pattern` class.** `app/login/page.tsx` L47, `app/signup/page.tsx` L69: either remove
   the class or add the intended pattern utility to globals (frozen tokens only). Pick removal if unsure.
9. **D1 — Off-palette reds → `--destructive`.** Swap Tailwind reds for `text-destructive` /
   `bg-destructive/10` / `border-destructive/30`: `components/dashboard/recent-pickups.tsx` L~123;
   `components/admin/payout-override.tsx` L~234; `components/admin/price-grid.tsx` L~115;
   `components/ui/StatusBadge.tsx` L~16; `components/ui/leaderboard-rankings.tsx` L~231. (The
   `dashboard-content.tsx` quiz reds were a deliberate earlier "leave" for semantic feedback — align them too
   for consistency IF it stays legible, your call; keep error states distinguishable.)
10. **D2 — `alert()` → toast.** `profile-content.tsx` L~127/131 and `crew-content.tsx` L~156: use
    `toast.success`/`toast.error` (sonner). NOTE: the profile "saved successfully" alert is currently
    misleading (see Tier 2 A3 — the save may not persist); keep the toast wording neutral until A3 is fixed.
11. **D3 — Strip debug logs (some leak PII).** Remove `console.log`/`console.warn` debug lines in
    `admin-content.tsx` L~110 (logs all pickups + emails), `navbar.tsx` L~94/114/123/128/137/145 (emails),
    `profile-content.tsx` L~103/172/174. Keep genuine error logging.
12. **D5 — Import sectors from `lib/constants.ts`.** Replace the duplicated `OPERATIONAL_SECTORS` /
    `CREW_SECTORS` string-literal arrays in `dashboard-content.tsx` L~37, `schedule-pickup-modal.tsx` L~34,
    `crew-content.tsx` L~21, `admin-content.tsx` L~192 with the canonical import. (CLAUDE.md rule 5.)
13. **D7 — Confirm before cancelling a pickup.** `recent-pickups.tsx` L~119–127 → `handleCancelPickup`: add a
    confirm `Dialog` (already in the tree), matching the marketplace redeem-confirm pattern.
14. **D8 — `hasPickupToday` excludes cancelled.** `dashboard-content.tsx` L~90–94: add a status filter so
    cancelled pickups don't count.

---

## PART B — Visual / Responsive polish (from the screenshots — C-category, code/CSS only)

**V1 — Navbar element overlap when collapsed (the shrunk pill).**
- Root cause: in `components/ui/resizable-navbar.tsx`, `NavBody` animates to `width: 40%` (`minWidth: 800px`)
  on scroll, while `NavItems` is `absolute inset-0 ... justify-center` — it floats over the bar instead of
  taking layout space. In the collapsed pill the centered nav links overlap the left logo and the right
  login/"Join the Movement" cluster.
- Fix (keep the expanded state exactly as-is): in the collapsed (`visible`) state, stop the overlap — e.g.
  hide/scale-down `NavItems` when `visible`, or don't shrink `NavBody` so far / raise its `minWidth`, so the
  logo, centered links, and right buttons never collide. Verify at the scrolled/pill state across widths.
  Do NOT change the auth/role logic in `components/layout/navbar.tsx` — this is layout only.

**V2 — Credit balance number clipped ("YOUR BALANCE / 923 credits").**
- Likely the `AnimatedNumber` (NumberFlow) digits interacting with a tight card height/line-height/overflow.
  Check the balance blocks: `app/marketplace/marketplace-content.tsx` L~145 and
  `app/profile/profile-content.tsx` L~204 (the `<AnimatedNumber>` + label rows).
- Fix: give the number row enough line-height / vertical padding and remove any `overflow-hidden`/fixed
  height that clips the tall digits or the "credits" suffix; ensure it wraps/fits at the shown sizes. Keep
  `tabular-nums` and the token colors. Do NOT change the `balance`/credits data or the NumberFlow value.

**V3 — Crew hub stat/number clipping.** Same class of issue on the crew stat tiles
(`app/crew/crew-content.tsx`, the pending/stat tiles ~L245–285): check for numbers cut off by tile
height/overflow; fix with line-height/padding, tokens unchanged.

**V4 — Admin hub clipping ("Trashium Terminal" header + KPI cells).** Check the admin header/logo alignment
and the KPI/stat cells (`app/admin/admin-content.tsx`) for the same clipping; fix with spacing only.

> For all of V1–V4: verify at desktop **and** narrow breakpoints (e.g. 1280 / 1024 / 768 / 375) — no
> overlap, no cut-off text, no horizontal scroll. Theme tokens unchanged; this is spacing/layout only.

---

## Explicitly OUT of this batch (do NOT touch — separate sessions)

- **Tier 2 (live DB / RLS):** A2 (user_metadata admin bypass), A3 (profiles UPDATE policy), A6 (schema sync),
  A7 (global_impact policy), B10 (revoke anon). These change live security — a separate, verified session.
- **Tier 3 (features needing decisions):** A4 (earn loop), A5 (status vocabulary), B2 (coords at insert),
  B5 (admin management table restore/delete), B6 (incident report).
- **B9** (pricing seam RLS skew) — frozen ML path, report-only.

---

## Verify before reporting

`npx tsc --noEmit` fully clean → click through the four screens in the screenshots at desktop + a narrow
breakpoint (navbar scrolled to the pill; marketplace + profile balance; crew hub; admin hub) confirming no
overlap / no clipping / no horizontal scroll → `prefers-reduced-motion` still shows final states → no CLS →
A1 verified: a non-admin account can no longer read `/admin` data. Report the grouped diff. Stop after Tier 1.
