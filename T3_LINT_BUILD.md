# T3 — Deferred lint cleanup (build handoff)

> Goal: `npm run lint` exits 0. Verified sites this session. **The eslint-ignore is already
> done from chat** (see §0); the rest go to Fable so `tsc`/`lint` verify. Keep `npx tsc --noEmit`
> green. No behavior changes — types, dead-import removal, and (for the structural rules)
> scoped disables rather than risky pre-demo refactors.

---

## §0 Already done from chat

`eslint.config.mjs` — added `.claude/**` and `.agents/**` to `globalIgnores` (they held ~132
vendored skill scripts eslint was linting → the "hundreds of warnings"). Fable: just confirm the
warning count drops after this.

---

## §1 Tier A — safe, fix properly (no behavior change)

**`app/admin/admin-content.tsx` — remove 4 `no-explicit-any`:**
- **L93** `const setRequests = (data: any) => setPickups(data);` → `(data: PickupRequest[])`.
- **L112** `.map((p: any) => ({ ...p, location: normalizeSectorName(p.location) }))` — type the
  row to match the `select('*, profiles!..(full_name,email)')` shape, e.g.
  `(p: PickupRequest & { profiles?: { full_name?: string | null; email?: string | null } })`.
  (Whatever type keeps `...p`, `p.location`, and the later `p.profiles` access valid under `tsc`.)
- **L262** `const name = (p as any).profiles?.full_name || p.full_name || "";` → reuse the same
  cast as L112 / the B5 table cell:
  `(p as PickupRequest & { profiles?: { full_name?: string | null } }).profiles?.full_name`.
- **L304** `...{ ...p, status: mappedStatusValue as any }` → `mappedStatusValue as PickupStatus`
  (it's already a canonical string).

**`app/admin/admin-content.tsx` — remove unused imports** (confirmed unused after B5 used `Select`):
the whole `DropdownMenu` block (`DropdownMenu, DropdownMenuContent, DropdownMenuItem,
DropdownMenuTrigger`, L25-30) and `MoreHorizontal` (L37).

**`app/dashboard/dashboard-content.tsx` — L59** `const normalizePickup = (p: any): PickupRequest`
→ give `p` a concrete row type (match the fields the body reads) instead of `any`.

## §2 Tier B — type it, small judgement call

**`app/dashboard/dashboard-content.tsx` — L145** `useState<any>(null)` for `currentQuestion` →
type with the actual quiz-question shape used by the daily-ritual/quiz UI (import or define the
interface; `useState<QuizQuestion | null>(null)`). Pick the type that already flows into this
state so no casts are needed downstream.

## §3 Tier C — structural rules: prefer scoped disable over refactor (pre-demo)

These are working code; refactoring risks regressions right before the demo. Recommended:
add a `// eslint-disable-next-line <rule> -- <reason>` at each site rather than restructuring.
Use `npm run lint` to get the exact lines (they may have shifted).

- **2× `react-hooks/set-state-in-effect`** — a `useEffect` calls `setState` directly in its body.
  If the effect is genuinely "derive state from props on mount", a disable-with-reason is fine for
  now; a proper fix (derive during render / `useMemo`, or guard the set) can be a later pass.
- **1× `react-hooks/purity` (~L704-705, flagged at L708)** — `new Date(Date.now() - 30*24*60*60*1000)`
  and `new Date()` are computed inline in the `LeaderboardCard` render. Cleanest *safe* fix:
  hoist both into a `useMemo(() => ({from, to}), [])` (or compute once above the return) so render
  is pure — this one is low-risk to actually fix. Disable-with-reason is the fallback.

> Decision for the user: **(a)** scoped `eslint-disable` comments on the 3 structural items (fast,
> zero behavior risk — recommended for the demo), or **(b)** real refactors (purity via `useMemo`
> is safe; the two set-state-in-effect need care). Default to (a), revisit post-demo.

---

## §4 Verify

- `npx tsc --noEmit` clean.
- `npm run lint` exits **0** (no errors; the `.claude`/`.agents` warning flood is gone via §0).
- No functional/visual change — this is types, dead imports, and lint-rule handling only.
- Confirm no new `any` introduced and no import removed that's still referenced.
