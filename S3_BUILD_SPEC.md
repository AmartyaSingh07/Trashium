# S3 — Auth + Content + Shared Chrome: Build Spec

> **Status: SPEC FOR REVIEW.** Build in the VS Code Claude extension (see `VSCODE_HANDOFF_PROMPT.md` → S3).
> Consumes the S1 motion foundation (set-then-to primitives, `rise`/`interval` API). **No code until approved.**

---

## Mandatory rules (inherited — see `S1_BUILD_SPEC.md`)

- **Skill pipeline every session:** `/frontend-design` → `/gpt-taste` → `/impeccable` → `/ui-ux-pro-max`,
  plus **`/karpathy-guidelines`** (always-on code-quality lane) on the code. Non-overlapping lanes; skip a
  skill where its lane adds nothing (e.g. near-static legal pages need little taste input); one reconciliation
  pass at the end. Hard constraints beat all five.
- **THEME FROZEN:** terra/sage/linen/bark palette + fonts byte-for-byte identical. Hardcoded palette hex
  (e.g. `text-[#C2703D]` in the auth pages) is the palette — **do not** tokenize or alter it. (One exception
  is proposed in §4 — a genuine off-palette *defect*, decided consciously.)
- **Props/data flow identical**, reduced-motion honored, reuse the existing i18n keys.
- **Above-the-fold rule (from S1 a11y audit):** GSAP `Reveal`/`Stagger` apply hidden state after SSR paint
  → above-fold flash on slow hydration. **Above-fold entrances stay on CSS entrance** (`animate-fade-up*`,
  `animate-scale-in`); `Reveal`/`Stagger` are for **below-the-fold** scroll reveals only.

---

## 0. Goal & non-goals

**Goal.** Restyle the auth screens, the informational content pages, the legal pages, and the **shared
chrome** (Navbar, Footer, PageHero, PageShell, LegalPage) to the Editorial Botanical execution — applying
the S1 motion primitives to below-the-fold sections and the unified `.t-lift`/`.t-focus-ring` hover/focus
language — **without touching auth logic, the palette, or any data/prop shape.**

**The defining risk of S3: chrome propagates to every route.** Navbar + Footer render on **all** pages
(landing directly; about/careers/legal via `PageShell`; and they're on the S4–S6 routes too). A regression
here shows up site-wide, including on routes not yet redesigned. Verification must check multiple routes.

**Explicitly NOT in S3:**
- No change to Navbar auth/session logic: `getUser`, `onAuthStateChange`, the role-fetch-with-retry, the
  hardcoded admin-bypass email, logout. **Visual/motion only.**
- No change to login/signup **form logic**: `signInWithPassword`, `signUp`, validation, toasts, redirects.
- No palette/font changes (except the §4 footer defect, if approved).
- No i18n key invention for existing copy; reuse `nav`, `common`, `footer`, `auth`, `about`, `careers`,
  `legalCommon`, and the per-legal namespaces.
- No new dependencies. No Lenis/vaul.

---

## 1. Verified current state (scanned)

**Shared chrome:**
| File | Type | Role | Restyle risk |
|---|---|---|---|
| `components/layout/page-shell.tsx` | server | `Navbar → main → Footer` wrapper for informational pages | trivial |
| `components/layout/page-hero.tsx` | server | Editorial hero (eyebrow/title/highlight/subtitle), `animate-fade-up*`. **Above the fold.** | low — keep CSS entrance |
| `components/layout/legal-page.tsx` | server | Shared legal layout: sticky section index + prose; exports `P/UL/LI/Callout` helpers | low-med |
| `components/layout/navbar.tsx` | **client** | Auth state, role-fetch-with-retry, resizable collapse-on-scroll, mobile nav, lang/PWA buttons | **HIGH — logic-dense** |
| `components/layout/footer.tsx` | **client** | i18n footer links, brand, separator | low (+ §4 stray) |
| `components/ui/resizable-navbar.tsx` | client | Shared nav primitive (collapse/mobile). Restyle here hits the navbar globally | med — shared |

**Auth (both `"use client"`, full-screen centered glass card — above the fold):**
| File | Notes |
|---|---|
| `app/login/page.tsx` | Two-panel glass card, `BotanicalSVG`, `BrandLockup`, `KineticTypographyLoader` on loading, `animate-scale-in`. `text-[#C2703D]` = terra hex (leave). Form → `signInWithPassword`. |
| `app/signup/page.tsx` | Same shell, 4 fields, client validation, `signUp`. |

**Content + legal (server components, `PageShell` + `PageHero`, section cards below the fold):**
| File | i18n ns | Notes |
|---|---|---|
| `app/about/page.tsx` | `about` | 8 sections of glass/border cards after the hero |
| `app/careers/page.tsx` | `careers` | stage note, why-cards, 8 role cards, contact CTA |
| `app/privacy-policy`, `terms-of-service`, `cookie-policy` | `legalCommon` + per-page | all render `<LegalPage sections=…>` |

**Off-palette audit (S3 chrome):** exactly **one** stray — `footer.tsx:72`
`text-slate-600 hover:text-emerald-600` on the how-it-works link (every sibling uses `text-smoke hover:text-terra`).
`resizable-navbar.tsx` is palette-clean. See §4.

---

## 2. Files touched in S3

**MODIFY (restyle/motion only):**
```
components/layout/navbar.tsx        hover/focus language + mobile-menu motion ONLY; auth/role/scroll logic untouched
components/layout/footer.tsx        entrance motion + §4 stray decision
components/layout/page-hero.tsx     botanical-ease CSS entrance (stays CSS — above fold)
components/layout/page-shell.tsx    likely untouched (pure composition) — leave unless a wrapper hook is needed
components/layout/legal-page.tsx    Reveal the sticky-index + prose sections (below fold)
components/ui/resizable-navbar.tsx  ONLY if a hover/focus token is needed globally — otherwise leave
app/login/page.tsx                  keep animate-scale-in (above fold); .t-lift/.t-focus-ring polish; NO form-logic change
app/signup/page.tsx                 same as login
app/about/page.tsx                  Reveal/Stagger the below-fold sections
app/careers/page.tsx                Reveal/Stagger the below-fold sections
```
**Do NOT touch:** any Supabase call, the role state machine, the admin-bypass email, form submit handlers,
`lib/*`, `/ml`, i18n message files (beyond reusing keys).

---

## 3. Navbar — the conservative restyle (highest-risk file)

The navbar is a logic-dense client component (auth + role retry + scroll collapse + mobile menu). **Restyle
is visual/motion only:**
- Apply the unified `.t-lift` / `.t-focus-ring` language to `NavbarButton`s and nav links for a consistent
  hover/focus feel (tokens already in globals.css; no color change).
- The mobile menu open/close may get a botanical-ease refinement **only if** `resizable-navbar.tsx` already
  owns that animation — prefer refining timing/easing over restructuring.
- **Untouched:** the two `useEffect` auth/role blocks, `handleLogout`, `navItems` role logic, `navCollapsed`
  scroll listener, the admin-bypass, all Supabase calls. Do not "simplify" the retry logic (karpathy: this is
  intentional resilience, not dead code — leave it).
- Do **not** add `<Reveal>` to the navbar — it's fixed/above-fold chrome; a scroll reveal is wrong here.

If `/karpathy-guidelines` flags the `console.log` debug lines, that's a separate cleanup — **out of S3 scope**
(don't bundle logic changes into a restyle). Note them for later, don't act.

---

## 4. Footer off-palette stray (conscious decision)

`footer.tsx:72` styles the how-it-works link `text-slate-600 hover:text-emerald-600` — Tailwind default
slate/emerald, **not** the earthy palette. Every sibling link uses `text-smoke hover:text-terra`.

- **This is a defect, not a theme color.** Aligning it to `text-smoke hover:text-terra` brings a stray element
  **into** the frozen palette — it honors the theme rather than changing it.
- **Recommendation: fix it** (slate→smoke, emerald→terra). It's the one place where "don't change colors" and
  "match the frozen palette" point the same way once you see it's an outlier.
- Strict-reading alternative: leave it byte-identical. Flagged so it's a **conscious** call — record it in the
  checkpoint. (Default: fix.)

---

## 5. Auth pages — above the fold, logic frozen

login/signup are full-screen centered cards → **above the fold**. Per the above-fold rule:
- **Keep `animate-scale-in`** (CSS entrance) for the card — do **not** wrap in `<Reveal>` (would flash).
- Polish with `.t-lift` on the card and `.t-focus-ring` on inputs/buttons if it sharpens the hover/focus feel
  within the existing tokens. Inputs already use terra focus rings — keep.
- `text-[#C2703D]` on the back link is the terra hex — **leave** (palette, frozen).
- **Form logic frozen:** `handleLogin`/`handleSignup`, `signInWithPassword`, `signUp`, validation, `toast`,
  `router.push`/`refresh`, `KineticTypographyLoader` gating — all untouched.

---

## 6. Content + legal pages — below-fold reveals

`about`, `careers`, and `LegalPage` are server components whose sections sit below the `PageHero`. The S1
primitives are client components and can be rendered by these server pages (standard RSC pattern):
- Wrap each below-fold section (or its heading) in `<Reveal>`; use `<Stagger>` for card grids (the problem
  cards, role cards, step cards, impact cards, legal section list) with `<StaggerItem className=…>` on the
  existing card markup (DOM-preserving, no wrapper divs — the S2 pattern).
- `PageHero` is **above the fold** → keep its CSS `animate-fade-up*` entrance, upgraded to the botanical ease.
  Do not `<Reveal>` it.
- Legal pages need little `/gpt-taste` input (near-static prose) — lean on `/frontend-design` for the reveal
  rhythm and `/ui-ux-pro-max` for the sticky-index/anchor UX; skip heavy taste iteration.

---

## 7. Motion application map

| Surface | Motion | Notes |
|---|---|---|
| Navbar / Footer | `.t-lift`/`.t-focus-ring` hover-focus only; footer content may `<Reveal>` on first scroll | Chrome — no scroll reveal on the fixed navbar |
| PageHero (above fold) | CSS `animate-fade-up*`, botanical ease | Never `<Reveal>` |
| Auth cards (above fold) | CSS `animate-scale-in` | Never `<Reveal>` |
| about / careers sections | `<Reveal>` headers, `<Stagger>` card grids | Below fold |
| LegalPage sections | `<Reveal>` the prose sections; sticky index stays put | Below fold; keep `scroll-mt-28` anchors working |

**Reduced-motion:** all primitives no-op to final state; CSS entrances are already neutralized by the global
reduced-motion block. Nothing extra.

---

## 8. i18n

Reuse `nav`, `common`, `footer`, `auth`, `about`, `careers`, `legalCommon`, and per-legal keys exactly. Route
slugs stay English (footer already notes this). No new keys unless genuinely new copy appears (default: none).

---

## 9. Verification (S3 gate) — propagation-aware

1. **`npx tsc --noEmit` clean** (only fully-trusted gate).
2. **Playwright before/after across MANY routes** — because chrome propagates, capture: `/`, `/login`,
   `/signup`, `/about`, `/careers`, `/privacy-policy`, **and** at least one route S3 doesn't redesign
   (`/dashboard` or `/crew`) to prove the Navbar/Footer change didn't break not-yet-restyled pages. The
   restyled routes change visually (review aid); the **un-restyled route's body must stay intact** apart from
   the shared chrome.
3. **Navbar behavior smoke test:** logged-out vs logged-in nav items, role-based items, scroll-collapse to the
   compact pill, mobile menu open/close, logout. All must still work — this is the highest regression risk.
4. **Auth smoke test:** login and signup submit paths still fire (validation, toast, redirect) — restyle
   didn't detach a handler.
5. **Reduced-motion:** everything visible at scrollY 0; no stranded sections; auth cards and hero present.
6. **Skill pipeline** run + one reconciliation; record the §4 footer decision.

---

## 10. Risk register

| Risk | Mitigation |
|---|---|
| Chrome change breaks a not-yet-redesigned route (S4–S6) | Playwright a non-S3 route; chrome-only diff expected there. |
| Navbar auth/role logic disturbed by a restyle | Visual/motion only; the two `useEffect`s, retry, logout, admin-bypass explicitly untouched. |
| `resizable-navbar.tsx` global restyle over-reaches | Prefer per-consumer classes in `navbar.tsx`; touch the shared primitive only if unavoidable. |
| Auth form handler detached during restyle | Don't edit `<form onSubmit>`, `Button type="submit"`, or the handlers; smoke-test both. |
| Above-fold flash on auth/hero | Keep CSS entrances (`animate-scale-in`, `animate-fade-up*`); never `<Reveal>` them. |
| §4 footer fix mistaken for a theme change | It aligns a stray to the frozen palette; recorded as a conscious call. |
| karpathy tries to prune navbar retry/console logic | Retry is intentional resilience; console cleanup is out of S3 scope — note, don't act. |

---

## 11. Implementation order (once approved)
0. Run `/frontend-design` for the section reveal rhythm within frozen tokens.
1. `page-hero.tsx` — botanical-ease CSS entrance (keeps above-fold behavior). Lowest risk, validates the look.
2. `about.tsx` + `careers.tsx` — `<Reveal>`/`<Stagger>` the below-fold sections (S2 DOM-preserving pattern).
3. `legal-page.tsx` — `<Reveal>` prose sections; verify sticky index + `#anchor` scroll still work.
4. `footer.tsx` — entrance polish + the §4 stray decision.
5. `navbar.tsx` — `.t-lift`/`.t-focus-ring` + mobile-menu easing ONLY; logic untouched.
6. `login.tsx` + `signup.tsx` — `.t-lift`/`.t-focus-ring` polish; CSS entrance kept; form logic untouched.
7. `npx tsc --noEmit` → multi-route Playwright (incl. one non-S3 route) → navbar + auth smoke tests → reduced-motion.
8. Hand off to VS Code skills: `/gpt-taste` → `/impeccable` → `/ui-ux-pro-max` + `/karpathy-guidelines`; one reconciliation pass.

**Chrome is the through-line** — restyle it once, verify it everywhere.
