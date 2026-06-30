# S1 — Foundation & Motion System: Build Spec

> **Status: SPEC FOR REVIEW. No code written yet.** Approve this, then I implement.
> Scope decisions locked from kickoff:
> - **Write spec → review → build.**
> - **Count-up:** introduce the shared primitive in S1; **do NOT** migrate the 3
>   existing call sites yet — that happens per-route in S2–S6 so each swap is isolated
>   and revertible.

---

## ⚠️ MANDATORY DESIGN SKILLS — applies to EVERY session (S1–S6)

Before writing or restyling any UI in any session, the implementer **must** invoke the
following design skills. This is a standing guardrail, not optional polish.

| Skill | Where it runs | Who invokes |
|---|---|---|
| `/frontend-design` (anthropic-skills) | Available in this Cowork session | The Cowork agent invokes it directly before producing UI. |
| `/impeccable` | VS Code Claude Code extension only (installed from GitHub) | **You must run it** in the VS Code extension — it is NOT loaded in the Cowork session. |
| `/gpt-taste` | VS Code Claude Code extension only (installed from GitHub) | **You must run it** in the VS Code extension. |
| `/ui-ux-pro-max` | VS Code Claude Code extension only (installed from GitHub) | **You must run it** in the VS Code extension. |

**Rule:** `/frontend-design` is invoked by the agent in-session before any component is built
or restyled. The three GitHub-installed skills (`/impeccable`, `/gpt-taste`, `/ui-ux-pro-max`)
live in the VS Code Claude Code extension and are **not available in this Cowork session**, so
they must be run by you there to review/refine the output. No UI session is considered complete
until all four have been applied. These supplement — never override — the hard constraints
(identical palette, identical props/data flow, reduced-motion, i18n key reuse).

### How the four skills complement each other (avoid conflicting edits)

They run in a **pipeline**, each owning a distinct layer, so they refine the same output instead
of fighting over it. Order matters: build first, then taste, then polish, then audit.

| Stage | Skill | Owns (its lane) | Must NOT touch |
|---|---|---|---|
| 1. Generate | `/frontend-design` | Structure, layout, component composition, the Editorial Botanical execution within existing tokens | Palette, props/data flow |
| 2. Taste pass | `/gpt-taste` | Aesthetic judgment — spacing rhythm, type hierarchy, restraint, "does this feel premium" | Functional logic, data wiring |
| 3. Craft pass | `/impeccable` | Pixel-craft — alignment, optical balance, micro-spacing, hover/focus detail, motion timing feel | Palette tokens, layout structure decided in stage 1 |
| 4. UX audit | `/ui-ux-pro-max` | Usability, accessibility, flow, state coverage (empty/loading/error), responsive correctness | Visual taste already settled above |

**Conflict-resolution rules (so they "complement, not break"):**
1. **Hard constraints win over all four skills, always.** If any skill suggests a palette change,
   a prop/data-flow change, an i18n key invented for existing copy, or a motion that ignores
   reduced-motion → **reject that suggestion**, keep the constraint. The skills serve the redesign;
   they don't get to redefine it.
2. **Lane ownership prevents thrash.** A later-stage skill does not re-litigate a decision owned by
   an earlier stage unless it's a clear defect. `/impeccable` polishes the layout `/frontend-design`
   produced; it does not restructure it. `/ui-ux-pro-max` audits the look the taste passes settled;
   it does not re-skin it.
3. **"Not for this task" → defer to the others.** If a given surface doesn't need a skill's lane
   (e.g. a near-static legal page needs no `/gpt-taste` opinion on data-viz density), skip that
   skill for that surface and let the relevant ones carry it. Applying a skill where it has nothing
   to add is how you get churn — don't force all four onto every element, force them onto every
   *session* across the elements that need them.
4. **One reconciliation at the end.** After all four have run on a route, do a single consolidation
   pass: if two suggestions genuinely conflict, the one closer to a hard constraint or to usability
   (stage 4) wins over pure aesthetics (stages 2–3). Record the call in the session checkpoint.

**Note on S1 specifically:** S1 ships **no visible UI** (the provider is a transparent
pass-through; primitives are applied to elements only in S2–S6). So in S1, `/frontend-design`
informs the *primitive API ergonomics and motion-token feel*, and the three VS Code skills have
little surface to act on — they come fully into force from **S2 (Landing)** onward where real
components are restyled. They are listed here because the rule is standing across all sessions.

---

## 0. Goal & non-goals

**Goal.** Lay the motion foundation every later session builds on, with **zero visible
route shipping** and **zero data/prop changes**. After S1, S2–S6 can `import` shared
primitives instead of hand-rolling reveals, staggers, and counters.

**Ships in S1:**
1. A GSAP + ScrollTrigger provider that mounts once, client-side, below the existing layout stack.
2. A small set of shared motion primitives (reveal-on-scroll, stagger container, kinetic heading).
3. A `<NumberFlow>`-backed stat primitive (`AnimatedNumber`) that the 3 legacy counters will migrate to **later**.
4. `globals.css` additions: motion tokens (durations, the signature easing, distances) + a unified hover/focus language as opt-in utility classes.

**Explicitly NOT in S1 (hard constraints from handoff):**
- No color changes. Palette stays identical.
- No edits to `/ml`, `lib/pricing.ts`, `price_estimates`, or the ML→client data flow.
- No edits to any `page.tsx` data fetching or auth guard, no prop-shape changes.
- No migration of the 3 existing count-up call sites (deferred).
- No Lenis, no vaul.
- No new visible route. `app/page.tsx` and friends are untouched in S1.

---

## 1. Verified current state (scanned, not assumed)

**Installed & ready (from `package.json`):** `gsap ^3.15.0`, `@number-flow/react ^0.6.1`,
`motion ^12.40.0`, `embla`, `lottie-react`, Playwright (dev). Next 16.2.4 / React 19.2.4.

**`app/layout.tsx`** — server component. Renders, inside `<NextIntlClientProvider>`:
Ribbons (z-0, `--ribbon-opacity`), `.grain-overlay` (z-2), content (`relative z-10`),
`<SiteLoadGate>`, `<ServiceWorkerRegister>`, `<Toaster>`. **The GSAP provider slots in here.**

**`app/globals.css`** — `@theme inline` palette + shadcn vars + utility/component layers.
Already defines the signature easing inline in two places: `t-rise` and `t-ring-fill`
use `cubic-bezier(0.22, 1, 0.36, 1)`. There is **already a global reduced-motion block**
(lines ~396–403) that neutralizes CSS animation/transition durations. **S1 adds tokens but
must not duplicate or weaken that block.**

**Three count-up implementations confirmed:**
| # | File | Mechanism | Used by | Notable API |
|---|------|-----------|---------|-------------|
| 1 | `components/ui/count-up.tsx` (`CountUp`) | rAF tween on `value` change, self-honors reduced-motion via `matchMedia` | gamification widgets (daily-ritial, leaderboard) | props `{ value, durationMs, className, format }` |
| 2 | `components/ui/animated-counter.tsx` (`AnimatedCounter`, default export) | rAF + `IntersectionObserver` (fires on scroll-into-view, threshold 0.3) | landing impact stats | props `{ end, duration, suffix, prefix, decimals }` |
| 3 | `.credits-number` CSS shimmer (`globals.css`) | pure CSS keyframe gradient sweep, not a counter | dashboard credits | className only |

> Note #3 is a *shimmer*, not a value tween — it is decorative and will **not** be replaced
> by `AnimatedNumber`. Only #1 and #2 are "count-up" in the numeric sense. The spec keeps all
> three until per-route migration.

---

## 2. Files created / modified in S1

### CREATE — 5 new files
```
components/motion/gsap-provider.tsx      "use client" — registers ScrollTrigger, context + reduced-motion guard
components/motion/reveal.tsx             "use client" — <Reveal> reveal-on-scroll wrapper
components/motion/stagger.tsx            "use client" — <Stagger> / <StaggerItem> container
components/motion/kinetic-heading.tsx    "use client" — <KineticHeading> per-word/line reveal
components/ui/animated-number.tsx        "use client" — <AnimatedNumber> NumberFlow wrapper (the future counter)
```
A single barrel `components/motion/index.ts` re-exports the four motion primitives for clean imports.

### MODIFY — 2 existing files
```
app/layout.tsx     mount <GsapProvider> once (wrap the z-10 content node)
app/globals.css    add motion-token block + unified hover/focus utilities (append-only; touches nothing existing)
```

**Nothing else is touched in S1.** The 3 counters, all `page.tsx` files, all `*-content.tsx`,
`/ml`, `lib/pricing.ts` — untouched.

---

## 3. `globals.css` additions (exact, append-only)

Appended after the existing keyframes, **before** the loader block. New `:root` tokens go in a
new dedicated block so they don't disturb the existing `:root`.

```css
/* ── S1: MOTION TOKENS — single source for the Editorial Botanical motion language ── */
:root {
  /* Signature easing (already used inline by t-rise/t-ring-fill — now canonical) */
  --ease-botanical: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-botanical-out: cubic-bezier(0.16, 1, 0.3, 1);

  /* Durations — "growth, not flash": slow, organic */
  --motion-fast:   0.4s;
  --motion-base:   0.7s;
  --motion-slow:   1.1s;

  /* Reveal travel distances */
  --motion-rise:   24px;   /* default reveal translateY */
  --motion-rise-sm: 12px;

  /* Stagger cadence */
  --motion-stagger: 0.08s;
}

/* Unified hover/focus language — OPT-IN utilities, applied per element in later sessions.
   Nothing here changes a component's look until a class is added to it. */
@layer utilities {
  .t-lift {
    transition: transform var(--motion-fast) var(--ease-botanical),
                box-shadow var(--motion-fast) var(--ease-botanical);
  }
  .t-lift:hover { transform: translateY(-2px); box-shadow: var(--t-shadow-lg); }
  .t-lift:active { transform: translateY(0); }

  /* Consistent keyboard-focus ring across the redesign (terra, token-driven) */
  .t-focus-ring:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
    border-radius: var(--radius);
  }
}
```

**Why a separate `:root` block, not editing the existing one:** keeps the diff append-only and
trivially revertible; the existing color `:root` is left byte-for-byte intact.

**Reduced-motion:** no new media block needed — the existing global reduce block already
neutralizes CSS transitions/animations, which covers `.t-lift`. The JS primitives guard
themselves (see §5).

---

## 4. GSAP provider — how it slots into `layout.tsx`

`components/motion/gsap-provider.tsx` (`"use client"`):
- On mount, `gsap.registerPlugin(ScrollTrigger)` once (module-guarded so it doesn't re-register).
- Reads `prefers-reduced-motion`. If reduced, it sets a flag (via a tiny React context) so every
  primitive renders content in its final state with no animation, and it does **not** create
  ScrollTriggers.
- Provides `MotionContext` ( `{ reduced: boolean }` ) consumed by `<Reveal>`, `<Stagger>`, `<KineticHeading>`.
- Renders `{children}` (pass-through; adds no DOM wrapper that could shift layout).
- On unmount / route change, kills its ScrollTriggers (`ScrollTrigger.getAll().forEach(t => t.kill())` scoped via `gsap.context`).

**Wiring in `layout.tsx`** — minimal, wraps only the content node:
```tsx
import GsapProvider from '@/components/motion/gsap-provider';
...
<div className="relative z-10">
  <GsapProvider>
    {children}
  </GsapProvider>
</div>
```
Because `GsapProvider` returns `{children}` directly (a fragment, no wrapper div), the rendered
DOM is **identical** to today — Playwright before/after on every route should be pixel-stable
since no primitive is applied to any element yet. (This is the S1 verification claim, see §7.)

**Next 16 / RSC note:** `layout.tsx` stays a server component; `GsapProvider` is a client boundary
(`"use client"`). This is the standard server-layout-wrapping-client-provider pattern. I will read
`node_modules/next/dist/docs/` for any 16-specific provider/`"use client"` guidance before writing it.

---

## 5. The four motion primitives (APIs)

All are `"use client"`, all consume `MotionContext`, all no-op to final state under reduced-motion.

**`<Reveal>`** — reveal-on-scroll wrapper.
```tsx
<Reveal as="div" y={24} delay={0} once>{children}</Reveal>
```
- GSAP `from` (opacity 0, y `--motion-rise`) triggered by ScrollTrigger when element enters viewport.
- `once` (default true) → plays a single time. Eased with `--ease-botanical`.
- Reduced-motion → renders children at final opacity/position, no trigger.

**`<Stagger>` / `<StaggerItem>`** — staggered group reveal.
```tsx
<Stagger gap={0.08}><StaggerItem>…</StaggerItem><StaggerItem>…</StaggerItem></Stagger>
```
- One ScrollTrigger on the container; children animate with `--motion-stagger` cadence.
- Reduced-motion → all items final-state immediately.

**`<KineticHeading>`** — editorial per-word (or per-line) reveal for Cormorant display headings.
```tsx
<KineticHeading text="Turning waste into worth" splitBy="word" />
```
- Splits text into spans, reveals with rise + slight skew settle on the signature easing.
- Renders the **full plain string** as accessible text (split spans are `aria-hidden`, a visually-hidden real string carries the semantics) so screen readers and SEO see normal text.
- Reduced-motion → renders the plain string, no split.

**`<AnimatedNumber>`** — the consolidation target, wraps `@number-flow/react`.
```tsx
<AnimatedNumber value={1234} format={{ notation: 'standard' }} className="t-stat" />
```
- Thin wrapper over `<NumberFlow value=… format=… />`.
- Supports `prefix`/`suffix` (covers `AnimatedCounter`'s API) and a `format` Intl options object.
- NumberFlow respects reduced-motion natively; wrapper passes through.
- **Migration note (later sessions):** `CountUp({value})` → `<AnimatedNumber value=…>`;
  `AnimatedCounter({end, suffix, decimals})` → `<AnimatedNumber value={end} suffix=… format={{maximumFractionDigits: decimals}}>`
  optionally wrapped in `<Reveal>` to reproduce the scroll-trigger behavior. **Not done in S1.**

---

## 6. Import surface for later sessions
```ts
import { Reveal, Stagger, StaggerItem, KineticHeading } from '@/components/motion';
import GsapProvider from '@/components/motion/gsap-provider';
import { AnimatedNumber } from '@/components/ui/animated-number';
```

---

## 7. S1 verification (per-session guardrails)

1. **`npx tsc --noEmit` clean** — the only fully trusted gate (sandbox is flaky).
2. **Playwright before/after screenshots** of a representative set (landing, dashboard, login)
   — must be **pixel-identical**, because S1 applies no primitive to any element. Any diff means
   the provider shifted layout and is a bug. (Run `npx playwright install` once if not done.)
3. **Reduced-motion sanity:** with `prefers-reduced-motion: reduce`, primitives render final-state
   (manual check on a throwaway test mount, not shipped).
4. Confirm `ScrollTrigger` registers without console errors on a dev run (or Vercel preview if sandbox down).
5. **Design-skills gate:** `/frontend-design` invoked in-session for any UI; `/impeccable`,
   `/gpt-taste`, `/ui-ux-pro-max` run by you in the VS Code extension. Session not complete until all four applied.

---

## 8. Risk register

| Risk | Mitigation |
|---|---|
| Provider adds a wrapper div → layout shift | Provider returns `{children}` as fragment; Playwright diff catches any shift. |
| ScrollTrigger double-registers across HMR | Module-level guard before `registerPlugin`. |
| RSC/client boundary mistake in Next 16 | Read `node_modules/next/dist/docs/` before writing; provider is the only new client boundary in layout. |
| Touching the existing reduced-motion block | We don't — additions are append-only; existing block untouched. |
| Counter migration sneaks in | Explicitly out of scope; the 3 call sites are not edited in S1. |
| `achievement-*` / `ui-trophy` false-positive deletion (audit) | Out of S1 scope entirely; not touched. |

---

## 9. Implementation order (once approved)
0. **Invoke `/frontend-design`** to set the motion-token feel + primitive API ergonomics
   (the only lane with surface to act on in S1 — see skills note above).
1. `globals.css` token + utility additions (append-only).
2. `gsap-provider.tsx` + `MotionContext`.
3. `reveal.tsx`, `stagger.tsx`, `kinetic-heading.tsx`, `index.ts` barrel.
4. `animated-number.tsx`.
5. Wire `GsapProvider` into `layout.tsx`.
6. `npx tsc --noEmit` → Playwright pixel-diff → reduced-motion check.
7. **Hand off to VS Code:** run `/impeccable`, `/gpt-taste`, `/ui-ux-pro-max` there to
   review the primitives + tokens before S2 starts consuming them. Reconcile per the
   conflict rules above; record the outcome in the checkpoint.

> From **S2 onward**, every route session runs the full four-skill pipeline (§ "How the four
> skills complement each other") on the actual components being restyled — generate → taste →
> craft → audit → one reconciliation pass — before the `tsc` + Playwright gate.

**Deliverable at the end of S1:** foundation merged, every route pixel-identical, S2 unblocked.
```
