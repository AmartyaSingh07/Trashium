# S4 — Household Dashboard: Build Spec

> **Status: SPEC FOR REVIEW.** Build in the VS Code Claude extension (see `VSCODE_HANDOFF_PROMPT.md` → S4).
> Heaviest session (~1.5×). Consumes S1 primitives (set-then-to, `rise`/`interval`). **No code until approved.**

---

## Mandatory rules (inherited — see `S1_BUILD_SPEC.md`)

- **Skill pipeline:** `/frontend-design` → `/gpt-taste` → `/impeccable` → `/ui-ux-pro-max` + always-on
  **`/karpathy-guidelines`**. Skip a lane where it adds nothing; one reconciliation pass; hard constraints win.
- **THEME FROZEN:** palette + fonts byte-identical. Hardcoded palette hex (`#C2703D`, `#8FA37E`, `#4A6741`…
  everywhere in this surface) IS the palette — do not tokenize/alter. Two genuine off-palette *defects* are
  proposed for a conscious call in §5.
- **Props/data flow identical**, reduced-motion honored, reuse i18n keys.
- **Above-the-fold rule:** GSAP `Reveal`/`Stagger` = below-fold scroll reveals only. Above-fold dashboard
  content (welcome header, impact cards) keeps its CSS `animate-fade-up*` entrances.
- **CLAUDE.md rule 11 (hard):** daily actions/streaks go through `log_daily_action` RPC ONLY. Never write
  profile streak columns or client credit math. S4 touches none of that logic.

---

## 0. Goal & non-goals

**Goal.** Restyle the household dashboard to Editorial Botanical — below-fold reveals, the unified
hover/focus language, and the `CountUp → AnimatedNumber` migration for this surface's counters — **without
touching the ML pricing quote, the daily-ritual/quiz/achievement RPC logic, or any data/prop shape.**

**Explicitly NOT in S4:**
- **No change to the ML quote path** in `schedule-pickup-modal.tsx`: the `estResult` computation,
  `quotePickup`/pricing calls, weights, sectors, distance. Restyle + migrate the *display* only (§4).
- No change to `log_daily_action`/`get_daily_status` calls, quiz logic, achievement unlock logic,
  cancel/reschedule handlers, leaderboard ranking math, marketplace-gate math.
- **Do NOT delete the `ui.trophy` / achievement-* cluster** — it's live (`AchievementUnlocked` renders here).
  If `/karpathy-guidelines` flags the `'ui.trophy'` alias import as unusual, leave it — it's intentional
  (tsconfig alias), not dead code.
- No palette/font changes (except the §5 defects, if approved). No new i18n keys for existing copy.
- No dependency changes.

---

## 1. Verified current state (scanned)

**`app/dashboard/page.tsx`** (server) — auth guard + redirect, fetches profile, pickups, badges,
`get_household_leaderboard`, `get_daily_status`; passes `{profile, initialPickups, badges, leaderboard,
dailyStatus}` to `DashboardContent`. **Untouched in S4** (data/auth layer).

**`app/dashboard/dashboard-content.tsx`** (client, ~830 lines) — the whole interactive dashboard:
welcome header, 3 `ImpactCard`s, "Your Grove" cluster (EcoLevelBadge, DailyRitual, badges grid, ways-to-earn
+ marketplace teaser), RecentPickups panel, Sector Leaderboard, eco-quiz modal, achievement unlock. Heavy
RPC/logic. Uses `animate-fade-up*` entrances throughout. Hardcoded palette hex throughout (leave).

**Components (dashboard-scoped):**
| File | Type | Notes |
|---|---|---|
| `components/dashboard/impact-card.tsx` | server-ish (no "use client") | 3 hero stats; **static** value render; credits card uses `.credits-number` **shimmer** (decorative, NOT a counter — keep) |
| `components/dashboard/schedule-pickup-modal.tsx` | client | **ML-quote consumer**; `CountUp` at L453 shows the quoted payout |
| `components/dashboard/eco-level-badge.tsx` | client | eco tier badge; exports `TRASHIUM_EVALUATION_TIERS`, `getTierIcon(Url)` |
| `components/dashboard/recent-pickups.tsx` | client | pickup list + cancel/reschedule UI |
| `components/ui/daily-ritual.tsx` | client | gamification; `CountUp` at L238 (freezes) |
| `components/ui/leaderboard-card.tsx` + `leaderboard-podium.tsx` | client | `CountUp` at podium L230 (credits) |

**`CountUp` migration sites for S4 (3):** `schedule-pickup-modal:453`, `daily-ritual:238`,
`leaderboard-podium:230`. (Landing's was done in S2.) After these, grep for remaining `count-up` importers;
if none, removing `count-up.tsx` is *optional* cleanup — don't force it in S4.

**Off-palette strays found:** `dashboard-content.tsx:434` `text-slate-950` (greeting h1);
quiz-modal error states `bg-red-50 border-red-300 text-red-800` / `text-red-700` (L742, L775). See §5.

---

## 2. Files touched in S4

**MODIFY:**
```
app/dashboard/dashboard-content.tsx        below-fold Reveal/Stagger; .t-lift/.t-focus-ring; §5 stray(s); logic untouched
components/dashboard/schedule-pickup-modal.tsx   restyle chrome + CountUp→AnimatedNumber DISPLAY (§4); quote logic frozen
components/dashboard/impact-card.tsx        entrance/hover polish; keep static values + credits shimmer (see §3)
components/dashboard/eco-level-badge.tsx    hover/focus polish only
components/dashboard/recent-pickups.tsx     restyle rows; cancel/reschedule handlers untouched
components/ui/daily-ritual.tsx              CountUp→AnimatedNumber (freezes); restyle; RPC-driven props untouched
components/ui/leaderboard-card.tsx / leaderboard-podium.tsx   CountUp→AnimatedNumber (values); restyle
```
**Do NOT touch:** `app/dashboard/page.tsx`, any Supabase RPC/query call, the quiz/achievement/quote/
cancel/reschedule logic, `ui.trophy`, `lib/*`, `/ml`.

---

## 3. ImpactCard — keep it simple (don't break the shimmer)

The 3 hero cards render values **statically** today (no count-up), and the **credits card uses the
`.credits-number` CSS shimmer** (gradient `background-clip:text`). NumberFlow renders its own inner spans, so
nesting `<AnimatedNumber>` inside the shimmer element would fight the gradient clip.

- **Default S4: leave ImpactCard values as-is** (static, credits shimmer intact). Apply only entrance/hover
  polish. Lowest risk, and these were never counters.
- **Optional (gated):** if the taste pass wants count-up parity with the landing, migrate **only the kg/co2
  cards** to `<AnimatedNumber>` (numeric value + unit as `suffix`), and **leave the credits card on the
  shimmer**. This changes ImpactCard's `value` contract (string-with-unit → number+suffix) so it's a real
  edit — only do it if wanted, and keep credits untouched. Record the call.

---

## 4. The ML-quote CountUp migration (most delicate change)

`schedule-pickup-modal.tsx:453`:
```tsx
₹<CountUp value={estResult.userPayoutTotal} format={(n) => n.toFixed(2)} />
```
**`CountUp`'s `format` is a function; `AnimatedNumber`/NumberFlow's `format` is Intl.NumberFormat OPTIONS.**
Translate, don't copy:
```tsx
₹<AnimatedNumber value={estResult.userPayoutTotal}
   format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
```
- Keep the `₹` as the literal prefix (or `prefix="₹"`) — do NOT switch to Intl `currency` style (would change
  formatting/spacing). Two-decimal display must match today's `toFixed(2)`.
- **`estResult` and everything feeding it (weights, sector, distance, `userPayoutPerKg`, `logisticsPerKg`,
  the pricing call) are FROZEN.** Only the number's render component changes. The `/kg · logistics · km`
  line below stays byte-identical.
- Verify: pick materials + weights + sector → the payout shows the same 2-dp value as before, and updates
  live as inputs change (NumberFlow animates between values — that's the upgrade).

For `daily-ritual:238` (`freezes`, integer) and `leaderboard-podium:230` (`value`, integer credits): plain
`<AnimatedNumber value={…} className="t-countup …" />` — no `format` needed. Keep the `t-countup` class so
the JetBrains/tabular-nums styling holds; verify NumberFlow inherits it (visual check).

---

## 5. Off-palette strays (conscious calls)

1. **`dashboard-content.tsx:434` `text-slate-950`** on the greeting h1 — off-palette; every other heading uses
   `text-bark`. **Recommend: fix → `text-bark`** (aligns a stray into the frozen palette, like the S3 footer).
2. **Quiz-modal error states** (`bg-red-50 border-red-300 text-red-800`, `text-red-700`) — Tailwind default
   red for "incorrect answer" feedback. The palette has `--destructive: #C0392B`. **Judgment call:** these are
   *semantic error feedback*, not brand surface; conventional red aids clarity. **Default: leave** (out of a
   pure restyle's remit); optionally map to the `destructive` token if the taste/UX pass prefers palette
   cohesion. Record whichever way.

Everything else that "looks like a color literal" (`#C2703D`, `#8FA37E`, `#4A6741`, `#EDE5D8`, etc.) is the
palette — **do not touch.**

---

## 6. Motion application map

| Zone (top → bottom) | Fold | Motion |
|---|---|---|
| Welcome header + Schedule button | above | Keep CSS `animate-fade-up`; `.t-lift`/`.t-focus-ring` on the button |
| 3 Impact cards | above | Keep CSS `animate-fade-up-delay-1`; hover polish; values per §3 |
| "Your Grove" (eco-level, daily-ritual, badges, ways-to-earn) | above→mid | Top stays CSS; the badges grid may `<Stagger>` if it sits below the fold on common viewports (judgment) |
| Recent Pickups panel | mid/below | `<Reveal>` the panel; `<Stagger>` the rows if desired |
| Sector Leaderboard | below | `<Reveal>` header + card |
| Quiz modal / achievement toast | overlay | Keep existing `animate-fadeIn`; do NOT `<Reveal>` overlays |

**Reduced-motion:** primitives no-op to final state; existing CSS entrances already neutralized globally.

---

## 7. Verification (S4 gate)

1. **`npx tsc --noEmit` clean** (bar the pre-existing marketplace:209, which S5 owns).
2. **Dashboard is auth-gated** — Playwright must run with a **logged-in household session** (seed/login
   first) or it redirects to `/login`. If an authed Playwright session isn't available, verify the dashboard
   on the local dev server with a real login and capture before/after manually. Note this in the report.
3. **ML-quote smoke test (critical):** open Schedule Pickup, enter materials + weights + a sector; confirm the
   payout shows the **same 2-dp ₹ value** as before and updates live. The `/kg · logistics · km` line
   unchanged. Prove the quote wasn't disturbed.
4. **Daily-ritual/quiz/achievements still fire:** login check-in toast, segregation, quiz correct/strike caps,
   achievement unlock — all functional (RPC logic untouched).
5. **Counters:** freezes + leaderboard values + payout animate via NumberFlow; none stranded at 0; reduced-
   motion shows final values.
6. **No CLS/overflow; above-fold content not stranded** (impact cards/welcome visible on load).
7. **Skill pipeline** + one reconciliation; record §3 (ImpactCard) and §5 (stray) decisions.

---

## 8. Risk register

| Risk | Mitigation |
|---|---|
| ML quote disturbed by the modal restyle | Only the payout's render component changes; `estResult` + pricing frozen; §4 smoke test. |
| `format` function → Intl options mistranslated | Explicit `{minimumFractionDigits:2,maximumFractionDigits:2}`; verify 2-dp parity. |
| `.credits-number` shimmer broken by AnimatedNumber | Don't nest AnimatedNumber in the credits card; keep it static (§3). |
| Daily-ritual/quiz/achievement RPC logic touched | Restyle only; `log_daily_action`/`get_daily_status`/quiz/achievement handlers frozen (rule 11). |
| `ui.trophy` cluster deleted as "dead" | Explicitly live — do not remove; karpathy note only. |
| Above-fold dashboard content stranded/flash | Keep CSS entrances above the fold; Reveal/Stagger below only. |
| Auth gate blocks verification | Use a logged-in session for Playwright, or verify manually on dev; note in report. |
| Stray fix mistaken for theme change | `slate-950 → bark` aligns to frozen palette; recorded as conscious. |

---

## 9. Implementation order (once approved)
0. `/frontend-design` for the section rhythm within frozen tokens.
1. `impact-card.tsx` — entrance/hover polish; values static per §3. Validates the look, lowest risk.
2. `recent-pickups.tsx` + the leaderboard section — `<Reveal>`/`<Stagger>` below-fold; handlers untouched.
3. `daily-ritual.tsx` + `leaderboard-podium.tsx` — CountUp→AnimatedNumber (integers); restyle.
4. `schedule-pickup-modal.tsx` — restyle chrome + the §4 quote-display migration (careful); quote logic frozen.
5. `dashboard-content.tsx` — wire below-fold Reveal/Stagger, `.t-lift`/`.t-focus-ring`, §5 stray(s); all RPC/
   quiz/achievement/cancel logic untouched.
6. `eco-level-badge.tsx` — hover/focus polish.
7. `npx tsc --noEmit` → authed Playwright/manual dashboard capture → ML-quote + ritual/quiz smoke tests →
   reduced-motion → no-CLS check.
8. Hand off to VS Code skills: `/gpt-taste` → `/impeccable` → `/ui-ux-pro-max` + `/karpathy-guidelines`; one reconciliation.

**The ML quote is the tripwire** — restyle everything around it, change only how the number renders.
