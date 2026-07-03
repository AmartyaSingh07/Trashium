# S2 — Landing: Build Spec

> **Status: SPEC FOR REVIEW.** Build in the VS Code Claude extension (see `VSCODE_HANDOFF_PROMPT.md` → S2).
> Consumes the S1 motion foundation. **No code until approved.**

---

## Mandatory rules (inherited — see `S1_BUILD_SPEC.md` §"MANDATORY DESIGN SKILLS" + "THEME IS FROZEN")

- **Design-skills pipeline every session:** `/frontend-design` (generate) → `/gpt-taste` (taste)
  → `/impeccable` (craft) → `/ui-ux-pro-max` (UX audit). Non-overlapping lanes; skip a skill on a
  surface where its lane adds nothing; one reconciliation pass at the end. Hard constraints beat all four.
- **THEME FROZEN:** terra/sage/linen/bark palette + fonts stay byte-for-byte identical. No color
  refactors — including "tokenizing" the hardcoded hex in `flipping-rates.tsx` (those hexes already
  equal the palette; swapping them for `var(--color-*)` is a color-touch and pure churn — leave them).
- **Props/data flow identical**, reduced-motion honored, reuse the 326 i18n keys.

---

## 0. Goal & non-goals

**Goal.** Restyle the **public landing page** to the Editorial Botanical execution using the S1
primitives — editorial hero, staggered/section reveals on scroll, animated impact counters, a
polished how-it-works and rate-tile section — **without touching data, props, or the palette.**
This is the lowest-data-risk route (only two server-fetched props flow in).

**Ships in S2 (visible):** the redesigned `/` (landing) and its sections.

**Explicitly NOT in S2:**
- No color/font changes. No color refactors of `flipping-rates.tsx` inline hex.
- No change to `app/page.tsx` **data fetching** (`global_impact` query, `getTileRatesBySector()`).
  Layout/wrapper JSX in `page.tsx` may change; the **data and the props passed down may not**.
- No change to `FlippingRates`' rate-lookup logic, sector `<select>` data, or image-URL building
  (it reads `price_estimates` = ML chain — restyle only).
- No Navbar/Footer restyle — that's **S3 (shared chrome)**. Leave them as-is in S2.
- No new i18n keys unless genuinely new copy is added (default: reuse existing).

---

## 1. Verified current state (scanned)

**`app/page.tsx`** (server component) fetches and passes:
| Fetch | → Prop | Consumer | Sensitivity |
|---|---|---|---|
| `global_impact` single row → `impact` | `stats` | `<ImpactCounter>` | keep prop shape identical |
| `getTileRatesBySector()` → `tileRatesBySector` | `ratesBySector` | `<FlippingRates>` | **ML chain — do not touch the data** |
Render order: `Navbar, HeroSection, ImpactCounter, (div.animate-fadeIn > FlippingRates), HowItWorks, FeaturesSection, Footer`.

**Sections (all landing-scoped):**
| File | Type | i18n ns | Notes for restyle |
|---|---|---|---|
| `components/landing/hero-section.tsx` | server | `hero` | `BrandLockup`, badge, **h1 with inline gradient words** (`text-gradient-green`/`terra`), CTAs anchor `#how-it-works`, trust bar. Uses `animate-fade-up-delay-*`. |
| `components/landing/impact-counter.tsx` | client | `impact` | 4 glass stat cards; **uses legacy `<AnimatedCounter end suffix="+">` = migration target**. IntersectionObserver-triggered count-up. |
| `components/materials/flipping-rates.tsx` | client | (hardcoded copy) | 3D flip rate tiles, sector `<select>`, live `ratesBySector` prices. Already uses the botanical cubic-bezier + `animate-fade-up`. Inline hex = palette. |
| `components/landing/how-it-works.tsx` | server | `howItWorks` | 3-step glass cards, watermark numbers, connector lines. `id="how-it-works"` (hero anchor). |
| `components/landing/features-section.tsx` | server | `features` | 6 feature glass cards w/ icon glow. |

**Every section heading has an inline gradient highlight `<span>`** — this is the crux for KineticHeading (see §4).

---

## 2. Files touched in S2

**MODIFY (restyle only):**
```
app/page.tsx                              wrapper JSX only if needed; DATA + PROPS unchanged
components/landing/hero-section.tsx
components/landing/impact-counter.tsx     + migrate AnimatedCounter → AnimatedNumber (see §3)
components/landing/how-it-works.tsx
components/landing/features-section.tsx
components/materials/flipping-rates.tsx   restyle chrome only; rate logic + hex untouched
```
**Possibly MODIFY (primitive, additive — only if we choose kinetic hero, see §4):**
```
components/motion/kinetic-heading.tsx     add optional rich-segment API (additive, back-compatible)
```
**Do NOT touch:** Navbar, Footer (S3), `lib/pricing.ts`, `/ml`, any counter other than `AnimatedCounter` here.

---

## 3. Impact counter migration (the S2 count-up swap)

Current: `<AnimatedCounter end={value} suffix="+" />` — rAF tween that starts when the card
scrolls into view (IntersectionObserver, threshold 0.3).

Target: `<AnimatedNumber>` (NumberFlow). **Caveat — not a pure drop-in:** NumberFlow renders its
`value` immediately and animates on *change*; it does **not** count up from 0 on mount. To preserve
the "count up when scrolled into view" effect:

```tsx
// inside ImpactCounter, per card (client component):
const [shown, setShown] = useState(0);
// when the card enters the viewport once → setShown(stat.value)
<AnimatedNumber value={shown} suffix="+" className="tabular-nums" />
```
Trigger the `setShown(target)` with **one** IntersectionObserver (reuse the existing pattern) or by
coordinating with `<Reveal>`. Reduced-motion: NumberFlow shows the final value with no animation
natively — and if reduced, set `shown = value` immediately so it never sits at 0.

Keep the grid, glass cards, icon chips, colors, and labels exactly as-is — only the number element
changes. Result: identical layout, nicer digit animation, one fewer bespoke rAF counter.

> `animated-counter.tsx` (the file) stays in the repo until every call site is migrated; S2 removes
> only the landing usage. Do not delete the file in S2.

---

## 4. KineticHeading vs the gradient-word headings (decision)

The hero h1 and all four section h2s embed gradient highlight words (`text-gradient-terra`/`green`).
`KineticHeading` as built (S1) takes a **plain string** and splits it — wrapping these headings with
it would **drop the gradient words**, a visible theme change. Two allowed paths:

- **Path A (recommended, lowest risk):** *don't* force KineticHeading on gradient headings. Instead
  wrap the existing heading markup in `<Reveal>` (or reveal it via a `<Stagger>` group) **for the
  below-the-fold section h2s**. The gradient spans render exactly as today; they just fade+rise in on
  scroll. Zero markup/theme risk. **The hero h1 is above the fold** — per the above-fold rule in §5 it
  keeps its CSS entrance, NOT `<Reveal>` (which would flash on hydration).
- **Path B (only if we want per-word kinetic on the hero):** extend `KineticHeading` with an
  **additive** rich-segment API — `segments={[{text, className?}, …]}` — so highlight words keep
  their gradient class while still animating per-word. Back-compatible (the `text` prop still works).
  This is a primitive change; it must keep the `sr-only` real-string + `aria-hidden` split and the
  reduced-motion plain render.

**S2 default = Path A.** Path B is a stretch, gated on a clean Playwright pass, and only if the taste
pass says the hero needs kinetic word reveal. Record the choice in the checkpoint.

---

## 5. Motion application map (where each primitive goes)

> **Primitive API — finalized after the S1 review pass (use these names):**
> - `<Stagger interval={0.08}>` — the cadence prop is `interval` (seconds), **not** `gap` (renamed to
>   kill the spatial/temporal ambiguity `gap` implies).
> - `<Reveal rise={24}>` / `<Stagger rise={24}>` — the travel prop is `rise` (matches `--motion-rise`),
>   **not** `y`.
> - `<Stagger>` targets **all descendant** `StaggerItem`s — do **not** nest a `<Stagger>` inside another
>   on the landing (a flat item list per group only).
>
> **Above-the-fold rule (from the S1 a11y audit):** GSAP `Reveal`/`Stagger` apply their hidden state
> in a layout effect *after* the SSR paint, so on slow hydration an above-the-fold element can flash
> visible→hidden→reveal. Therefore: **above-the-fold entrances use a CSS entrance** (the existing
> `animate-fade-up*`, upgraded to the botanical ease) — **not** the GSAP primitives. `Reveal`/`Stagger`
> are for **below-the-fold, scroll-triggered** reveals, where the hidden-first state is never seen.

| Section | Motion | Notes |
|---|---|---|
| Hero (above fold) | **CSS entrance only** (botanical-ease `animate-fade-up*`); optional Path B kinetic h1 | Do NOT wrap the hero in `<Reveal>` — it would flash on hydration. Keep the CSS load-in. |
| Impact counters | `<Stagger>` the 4 cards + inView-driven `<AnimatedNumber>` | Below fold — one trigger; cards rise in sequence, numbers count on enter. |
| Flipping rates | `<Stagger>` the tiles (replace the hand-rolled `animate-fade-up` + `animationDelay` loop) | Keep the 3D flip + shimmer exactly; only the entrance staggering is centralized. |
| How-it-works | `<Stagger>` the 3 step cards; **optional** ScrollTrigger pin (see risk) | The plan's "scroll-pinned" idea lives here — pin is the riskiest move; gate it (§8). |
| Features | `<Stagger>` the 6 cards | Straightforward staggered reveal. |

**Reduced-motion:** all of the above no-op to final state via the S1 primitives — nothing extra needed.

---

## 6. i18n

Reuse `hero.*`, `impact.*`, `howItWorks.*`, `features.*` keys exactly. `flipping-rates.tsx` copy is
currently hardcoded English (not keyed) — **do not** newly internationalize it in S2 (out of scope,
would be a behavior change); leave the strings as they are. Add keys only if genuinely new visible
copy is introduced (default: none).

---

## 7. Verification (S2 gate)

1. **`npx tsc --noEmit` clean** (only fully-trusted gate).
2. **Playwright before/after of `/`** — this route WILL change visually, so the diff is a *review
   aid*, not a pass/fail-on-identical. Capture before (current) and after; eyeball that:
   - layout structure is intact (no overflow, no collapsed sections, no CLS),
   - the WebGL Ribbons/grain stack still sits behind content,
   - hero is not stuck empty (no ScrollTrigger-hidden flash above the fold).
3. **Data integrity:** confirm `page.tsx` still fetches `global_impact` + `getTileRatesBySector()`
   and passes the same prop shapes; `FlippingRates` still shows live per-sector prices and the sector
   `<select>` still switches them. (ML chain smoke test.)
4. **Reduced-motion pass:** with `prefers-reduced-motion: reduce`, counters show final values, cards
   are visible (not stuck hidden), no motion.
5. **Design-skills pipeline** run and reconciled; record the Path A/B call.

---

## 8. Risk register

| Risk | Mitigation |
|---|---|
| KineticHeading drops gradient words | Path A (Reveal existing markup) by default; Path B is additive + gated. |
| ScrollTrigger hides hero above the fold → empty flash on load | Hero uses immediate reveal, not a viewport ScrollTrigger. |
| `AnimatedNumber` sits at 0 (no count-up / stuck) | inView 0→target trigger; reduced-motion sets value immediately. |
| how-it-works pin causes layout jank / CLS | Pin is optional + gated on a clean Playwright pass; fall back to plain `<Stagger>` if any shift. Pin must disable under reduced-motion. |
| Touching FlippingRates rate logic / hex | Restyle chrome only; rate lookup, `<select>` data, image URLs, and inline palette hex all untouched. |
| Accidentally restyling Navbar/Footer | Out of scope — S3 owns chrome. |
| Changing `page.tsx` data | Wrapper JSX may change; the two fetches and prop shapes may not. |

---

## 9. Implementation order (once approved)
0. Run `/frontend-design` to shape the section-level composition within frozen tokens.
1. `impact-counter.tsx` — migrate to `<AnimatedNumber>` with inView 0→target; `<Stagger>` the cards.
2. `features-section.tsx` — `<Stagger>` the 6 cards (simplest; validates the pattern).
3. `how-it-works.tsx` — `<Stagger>` the steps; evaluate optional pin (gated).
4. `flipping-rates.tsx` — centralize entrance via `<Stagger>`; flip/shimmer/logic/hex untouched.
5. `hero-section.tsx` — botanical-ease entrance; decide Path A/B for the h1.
6. `page.tsx` — only if wrapper JSX needs adjusting; data + props unchanged.
7. `npx tsc --noEmit` → Playwright before/after of `/` → data + reduced-motion smoke tests.
8. Hand off to VS Code skills: `/gpt-taste` → `/impeccable` → `/ui-ux-pro-max`; one reconciliation pass.

**One route per checkpoint** — `/` is the only surface S2 ships, so it's independently revertible.
