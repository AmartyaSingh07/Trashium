# VS Code Claude Extension — Hand-off Prompts (S1–S6)

> Paste the relevant prompt into the VS Code Claude Code extension to implement a session.
> **VS Code owns all code writes.** The Cowork agent stays hands-off to avoid two agents
> editing the same files. After a session, paste the diffs / `tsc` / Playwright results back
> into Cowork for review against the spec.

---

## Standing rules (apply to EVERY session)

- **Read the relevant `*_BUILD_SPEC.md` in full first.** Treat its §0 (non-goals) and the
  "MANDATORY DESIGN SKILLS" + "THEME IS FROZEN" sections as **hard constraints**.
- **Do NOT change** the palette, fonts, the core theme, component props, or the
  ML → Supabase → `page.tsx` → props → `*-content.tsx` data flow. Any color/theme suggestion
  from any skill is auto-rejected.
- **Reduced-motion:** every new animation honors `prefers-reduced-motion` (CLAUDE.md rule 12).
- **i18n:** reuse the existing 326 keys (en/hi/bn). Add keys only for genuinely new copy.
- **Server/client split:** data + auth in `page.tsx`; interactive UI in `*-content.tsx` (CLAUDE.md rule 2).
- **Next.js 16 + React 19:** read `node_modules/next/dist/docs/` before routing / RSC / data-fetching work.
- **Design skills pipeline (run whichever are installed in this extension):**
  `/frontend-design` (generate) → `/gpt-taste` (taste) → `/impeccable` (craft) → `/ui-ux-pro-max` (UX audit).
  They run as non-overlapping lanes — don't force all four onto every element; skip a skill on a
  surface where its lane has nothing to add. If a skill isn't installed here, don't block — use the
  others. Do ONE reconciliation pass at the end; hard constraints and usability win over pure aesthetics.
- **`/karpathy-guidelines` is ALWAYS ON (every session, cross-cutting).** It is a code-quality lane —
  it reviews the *implementation* (simplicity, readability, small clear functions, honest naming, no
  premature abstraction, no dead code), never the visuals, so it complements the design skills rather
  than competing. Two guardrails: it may NOT change props/data flow, the palette, or i18n keys for the
  sake of simplicity (hard constraints win), and it may NOT dissolve the intentional shared foundation
  (`components/motion/*`, `AnimatedNumber` — deliberately reused across S2–S6). It simplifies within
  components and wiring. Run it on every session's code as part of "done".
- **Verify before done:** `npx tsc --noEmit` must be clean (the only fully-trusted gate — the
  sandbox VM is flaky). Then a Playwright before/after screenshot diff for the touched route(s).
  One route per checkpoint so each redesign is independently revertible.
- **Stop and report** after `tsc --noEmit` is clean; paste the Playwright diff summary.

---

## S1 — Foundation & motion system

```
Read S1_BUILD_SPEC.md in full first. Treat §0 (non-goals) and the "MANDATORY DESIGN SKILLS"
+ "THEME IS FROZEN" sections as hard constraints you may not violate.

Implement S1 by following §9's numbered order exactly:
  globals.css motion tokens + opt-in hover/focus utilities (append-only; do NOT edit the
  existing color :root or the existing reduced-motion block)
  → components/motion/gsap-provider.tsx (+ MotionContext; returns {children} as a fragment,
    NO wrapper div, so every route stays pixel-identical)
  → reveal.tsx, stagger.tsx, kinetic-heading.tsx, index.ts barrel
  → components/ui/animated-number.tsx (NumberFlow wrapper)
  → wire <GsapProvider> into app/layout.tsx around the z-10 content node
  → npx tsc --noEmit → Playwright pixel-diff (landing, dashboard, login should be identical)

Before building, run whichever of these are installed here: /frontend-design, /gpt-taste,
/impeccable, /ui-ux-pro-max. In S1 they have minimal surface (no visible UI ships) — use
/frontend-design to inform primitive API ergonomics + motion-token feel.

Do NOT migrate the 3 existing count-up call sites (deferred to S2–S6). Do NOT touch /ml,
lib/pricing.ts, any page.tsx data fetching, or component props. Do NOT change the palette or fonts.

Stop after tsc --noEmit is clean and report the Playwright diff.
```

---

## S2 — Landing (`app/page.tsx` + `components/landing/*`)

```
Read S1_BUILD_SPEC.md (foundation) AND S2_BUILD_SPEC.md in full first. Hard constraints:
identical palette/fonts/props/data flow, reduced-motion, i18n key reuse, server/client split.

Restyle the landing surface using the S1 motion primitives (Reveal, Stagger, StaggerItem,
AnimatedNumber from @/components/motion and @/components/ui/animated-number). Lowest data risk —
page.tsx passes only `stats` (global_impact) and `ratesBySector` (getTileRatesBySector) down; keep
BOTH prop shapes and the two fetches identical. Editorial hero, staggered features, staggered
how-it-works (optional scroll-pin ONLY if Playwright stays clean), animated impact counters,
polished rate tiles.

Two things the spec pins down — do NOT deviate:
1. HEADINGS: every landing heading has an inline gradient highlight word (text-gradient-terra/green).
   KineticHeading takes a PLAIN string and would drop the gradient. DEFAULT = Path A: wrap the
   existing heading markup in <Reveal> (gradients preserved exactly). Do NOT put KineticHeading on
   gradient headings unless you first add its additive rich-segment API per the spec (Path B, gated).
2. COUNTERS: <AnimatedNumber> (NumberFlow) is NOT a drop-in for the scroll count-up — it renders its
   value on mount and won't count from 0. Preserve the effect: hold value at 0, set it to the target
   once the card enters the viewport (reuse the IntersectionObserver). Under reduced-motion set the
   value to target immediately so it never sits at 0. Remove ONLY the landing usage of AnimatedCounter;
   do not delete animated-counter.tsx (still used elsewhere until later sessions).

Do NOT touch: Navbar/Footer (S3 owns chrome), FlippingRates rate-lookup/sector-select/image-URL logic,
and its inline hex (that hex IS the palette — no color-tokenizing refactors, that's a theme touch).

Run /frontend-design → /gpt-taste → /impeccable → /ui-ux-pro-max, plus /karpathy-guidelines on the
code (all whichever are installed). One reconciliation pass; record the Path A/B call. Theme frozen.

npx tsc --noEmit clean → Playwright before/after of `/` (this route CHANGES, so use the diff to
verify no CLS/overflow/empty-hero, not to prove identical) → data + reduced-motion smoke test.
Stop and report.
```

---

## S3 — Auth + content + shared chrome

```
Read the foundation spec + S3 build spec first. Scope: login, signup, about, careers,
legal pages (privacy/terms/cookie), page-hero, page-shell, navbar/resizable-navbar, footer.
Chrome changes propagate everywhere — verify multiple routes.

Hard constraints as standing rules. Restyle with S1 primitives. Run the design-skills pipeline
(skip a skill's lane on near-static legal pages where it has nothing to add) + /karpathy-guidelines
on the code. Theme frozen.

npx tsc --noEmit clean → Playwright diff across the touched + a couple of propagation routes.
Stop and report.
```

---

## S4 — Household dashboard (heaviest)

```
Read S1_BUILD_SPEC.md + S4_BUILD_SPEC.md in full first. Scope: dashboard-content + components/dashboard/*
+ gamification widgets (daily-ritual, leaderboard-card/podium). Hard constraints: identical
palette/fonts/props/data flow, reduced-motion, i18n reuse, above-fold rule.

CRITICAL — the ML quote is the tripwire:
- schedule-pickup-modal.tsx consumes the ML pricing quote (estResult). Restyle chrome ONLY; the
  estResult computation, pricing calls, weights, sector, distance are FROZEN.
- Its CountUp (L453) uses format={(n)=>n.toFixed(2)} — a FUNCTION. AnimatedNumber/NumberFlow's
  format is Intl OPTIONS, not a function. Translate to:
  ₹<AnimatedNumber value={estResult.userPayoutTotal} format={{minimumFractionDigits:2,maximumFractionDigits:2}} />
  Keep the ₹ literal; do NOT use Intl currency style. Verify 2-dp parity + live updates.

CountUp→AnimatedNumber migration sites (3): schedule-pickup-modal:453, daily-ritual:238 (freezes,
integer), leaderboard-podium:230 (value, integer — keep the t-countup class). Do NOT delete count-up.tsx.

Other pins:
- ImpactCard: keep values static + the credits .credits-number SHIMMER intact (do NOT nest AnimatedNumber
  in the credits card). Count-up on kg/co2 only if the taste pass wants it (gated) — default: leave static.
- Do NOT touch log_daily_action/get_daily_status/quiz/achievement/cancel/reschedule logic (CLAUDE.md rule 11).
- Do NOT delete the ui.trophy / achievement-* cluster — it's LIVE (AchievementUnlocked renders). If karpathy
  flags the alias import, leave it.
- Above-fold (welcome, impact cards) keeps CSS animate-fade-up; Reveal/Stagger below-fold only (leaderboard,
  recent pickups). Never Reveal the quiz/achievement overlays.
- Off-palette strays: fix dashboard-content:434 text-slate-950 → text-bark (align to palette). Quiz-modal red
  error states = judgment call, default leave (semantic feedback). Record both.

Run /frontend-design → /gpt-taste → /impeccable → /ui-ux-pro-max + /karpathy-guidelines. One reconciliation;
record the ImpactCard + stray decisions. Theme frozen.

Verify: npx tsc --noEmit clean → dashboard is AUTH-GATED, so Playwright needs a logged-in household session
(or verify manually on dev, note it) → ML-quote smoke test (same 2-dp ₹, live updates) → ritual/quiz/
achievement still fire → counters animate, none stranded, reduced-motion shows finals → no CLS. Stop and report.
```

---

## S5 — Marketplace + Profile

```
Read S1_BUILD_SPEC.md + S5_BUILD_SPEC.md in full first. Scope: marketplace + profile (content
components only; the two page.tsx data/auth layers are untouched). Hard constraints: identical
palette/fonts/props/data flow, reduced-motion, i18n reuse, above-fold rule.

Two tripwires — FROZEN, restyle around them only:
- Marketplace: handleRedeem → supabase.rpc("redeem_marketplace_item", {p_item_id}), its result handling,
  balance/orders state, confirm dialog + gateUnlocked, ERROR_KEYS.
- Profile: handleSaveProfile → profiles.update({full_name, operating_zone}), edit-mode toggle, setLanguage.

Do FIRST — the :209 fix (milestone): marketplace-content.tsx:209
  {t("payoutBoostNote", { value: confirmItem.perk_value ?? 0 })}
perk_value is number|null; ?? 0 clears the last pre-existing tsc error (guarded block, unreachable fallback).
Then npx tsc --noEmit should be FULLY clean — confirm zero errors.

Counter migrations — these are CREDITS (integers shown grouped via toLocaleString), so KEEP default grouping;
do NOT add useGrouping:false (that was S4 currency-only):
- profile displayedCredits (hand-rolled useState(0)+animation) → <AnimatedNumber value={credits} />; remove
  the now-dead state+effect once migrated.
- marketplace header balance → <AnimatedNumber value={balance} /> (optional, recommended; animates on redeem).

Off-palette strays (conscious call, record mapping): marketplace STATUS_STYLES (amber/sky/emerald/red order
badges) + profile L105/108 (emerald/amber) — align to the earthy palette / existing .status-* vocabulary
(taste-pass decides exact mapping, it's a visible change). Safe auto-fix: profile L284 text-neutral-500 →
text-smoke. Everything #hex is palette — leave.

Motion: above-fold (headers, balance, profile credits/avatar) keep CSS entrances; Stagger the item grid +
badge grid, Reveal the orders section (below fold). Never Reveal the confirm dialog.

Run /frontend-design → /gpt-taste → /impeccable → /ui-ux-pro-max + /karpathy-guidelines. One reconciliation.
Theme frozen.

Verify: npx tsc --noEmit FULLY clean → auth-gated, so Playwright needs a logged-in household session (or
verify manually on dev, note it) → redeem smoke test (balance drops, order appears, toast; locked item shows
lockReason) → profile-save smoke test (name/zone persist, language switch) → credit counters animate WITH
grouping, none stranded, reduced-motion finals → no CLS. Stop and report.
```

---

## S6 — Crew + Admin + tracking (LAST)

```
Read S1_BUILD_SPEC.md + S6_BUILD_SPEC.md in full first. FINAL session. Scope: crew-content, admin-content
(+ components/admin/marketplace-admin.tsx), dashboard/tracking-content. Hard constraints: identical
palette/fonts/props/data flow, reduced-motion, i18n reuse, above-fold rule.

FIXED — do not touch:
- Leaflet map islands: components/maps/OptimizedRouteMap (crew) + app/dashboard/tracking/tracking-map
  (both dynamic ssr:false). Restyle the CONTAINER PANEL around each only; never wrap a map in Reveal
  (opacity:0 + reflow breaks tiles) or change its props.
- Realtime (FROZEN): crew channel.send() GPS broadcast, tracking channel.on("broadcast") listener, admin
  postgres_changes subscription. This INCLUDES the known send()→REST warning — do NOT fix it here
  (KNOWN_ISSUES.md #1, post-rehaul). Also frozen: crew accept/complete/cancel/reschedule + watchPosition,
  admin table logic + marketplace-admin CRUD + order-status mutations, all three page.tsx auth guards.

Motion guardrail (operational/realtime UI): animate STATIC wrappers only. Do NOT Stagger table rows (they
update via postgres_changes) — Reveal the panel/section as ONE unit instead. Do NOT Reveal maps or their
live overlay cards (keep animate-fade-up, botanical ease at most). Operational content stays immediately
visible — subtle single reveals, don't over-animate a control surface. Note: crew renders NO Navbar/Footer.

Off-palette strays = the BIG taste call (largest set of the rehaul, all semantic status/action colors).
Align to earthy palette, preserving DISTINGUISHABILITY (accept≠complete≠cancel, connected≠disconnected):
accept bg-blue-600 → bg-terra; complete/done/connected emerald → sage-deep/moss; pending/warning/disconnected
amber → amber-warm/clay; cancel/error/alert red → --destructive (palette brick red). Palette has no blue.
Record the final mapping. Everything #hex is palette — leave.

No CountUp/AnimatedNumber here — no counter migration (crew pendingCount stat: leave static).

Run /frontend-design → /gpt-taste → /impeccable → /ui-ux-pro-max + /karpathy-guidelines. One reconciliation;
record the §5 color mapping. Theme frozen.

Verify: npx tsc --noEmit FULLY clean → auth-gated by ROLE (crew/collector for /crew, admin for /admin,
household for tracking; crew needs GPS permission) so verify manually on dev per role, note coverage limits →
maps still render tiles/markers → realtime still flows (send() warning still logs, expected) → crew/admin
actions + CRUD work → color-coding legible & distinct → reduced-motion/no-CLS. Stop and report.

This is the LAST session — after it passes, the S1–S6 rehaul is COMPLETE. Then flag the post-rehaul
KNOWN_ISSUES.md #1 realtime follow-up.
```

---

## After each session (back in Cowork)

Paste the git diff (or the changed files) + the `tsc --noEmit` output + the Playwright diff
summary into Cowork. The Cowork agent reviews against the spec — especially:
- `GsapProvider` returns `{children}` as a fragment (no wrapper div → routes pixel-identical).
- `globals.css` changes are append-only; the color `:root` and reduced-motion block are untouched.
- Props in/out identical (protects the ML pricing chain).
- No invented i18n keys for existing copy; reduced-motion honored.
