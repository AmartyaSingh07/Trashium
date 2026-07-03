# S5 — Marketplace + Profile: Build Spec

> **Status: SPEC FOR REVIEW.** Build in the VS Code Claude extension (see `VSCODE_HANDOFF_PROMPT.md` → S5).
> Consumes S1 primitives (set-then-to, `rise`/`interval`). **No code until approved.**
> S5 also owns the pre-existing `marketplace-content.tsx:209` tsc fix (§4).

---

## Mandatory rules (inherited — see `S1_BUILD_SPEC.md`)

- **Skill pipeline:** `/frontend-design` → `/gpt-taste` → `/impeccable` → `/ui-ux-pro-max` + always-on
  **`/karpathy-guidelines`**. Skip a lane where it adds nothing; one reconciliation pass; hard constraints win.
- **THEME FROZEN:** palette + fonts byte-identical. Hardcoded palette hex (`#EDE5D8`, `#C2703D`, `#D4C5B0`…)
  IS the palette — leave it. Genuine off-palette *defects* proposed for a conscious call in §6.
- **Props/data flow identical**, reduced-motion honored, reuse i18n keys.
- **Above-the-fold rule:** GSAP `Reveal`/`Stagger` = below-fold only; above-fold entrances stay CSS
  (`animate-fadeIn`/`animate-fade-up`).
- **Counter grouping nuance (from S4):** `toFixed()`-based currency migrations need `useGrouping:false`;
  **credit counters here mirror `toLocaleString()`, which DOES group — so keep default grouping** (NOT
  `useGrouping:false`). Don't blindly copy the S4 flag.

---

## 0. Goal & non-goals

**Goal.** Restyle Marketplace and Profile to Editorial Botanical — below-fold reveals, unified hover/focus,
and the credit-counter migrations — **without touching the redeem RPC or the profile-save mutation.** Also
clear the pre-existing `marketplace-content.tsx:209` tsc error (§4).

**Explicitly NOT in S5:**
- **No change to the redeem flow:** `redeem_marketplace_item` RPC call, its result handling, the
  `balance`/`orders` state updates, the confirm dialog gate logic, `ERROR_KEYS` mapping.
- **No change to the profile-save mutation:** `handleSaveProfile` → `profiles.update({full_name,
  operating_zone})`, edit-mode toggle, the language `setLanguage` action.
- No change to `app/marketplace/page.tsx` or `app/profile/page.tsx` (data/auth/gate layer) — the
  `MarketplaceItemView` computation, access gate, badge eval stay as-is.
- No palette/font changes except the §6 defects (if approved). No new i18n keys for existing copy.
- No dependency changes. Don't touch Navbar/Footer (S3 owns; already done).

---

## 1. Verified current state (scanned)

**`app/marketplace/page.tsx`** (server) — auth guard, role redirect, builds `MarketplaceItemView[]`
(affordable/level/badge/stock/redeemable + lockReason), access gate (`credits≥500 && pickups≥1`), fetches
items/badges/orders. Passes to `MarketplaceContent`. **Untouched.**

**`app/marketplace/marketplace-content.tsx`** (client) — tier grid, item cards, confirm `Dialog`, redeem via
`supabase.rpc("redeem_marketplace_item", {p_item_id})`, "My Redemptions" orders list. State: `balance`,
`orders`, `confirmItem`, `redeeming`. Balance shown via `.toLocaleString()`.
- **Off-palette:** `STATUS_STYLES` (L53–58) uses `amber/sky/emerald/red-100/300/700/800` for order-status
  badges. (App has earthy `.status-*` classes in globals.css.) See §6.
- **`:209`** — `{t("payoutBoostNote", { value: confirmItem.perk_value })}`; `perk_value` is `number | null`
  → the pre-existing tsc error. See §4.

**`app/profile/page.tsx`** (server) — auth guard, builds `ProfileWithZone`, badge eval. Passes to
`ProfileContent`. **Untouched.**

**`app/profile/profile-content.tsx`** (client) — editable profile form (`isEditMode`, `fullName`, `phone`,
`zone`), `handleSaveProfile` → `profiles.update`, language switcher, avatar, eco-tier, badges grid. Uses
`animate-fadeIn`.
- **Hand-rolled counter:** `const [displayedCredits, setDisplayedCredits] = useState(0)` (L65) — a bespoke
  0→credits animation. **Migration candidate** (§5).
- **Off-palette:** L105/108 `emerald/amber-100/300/700/800` (a verification/status badge); L284
  `text-neutral-500` (disabled email field). See §6.

---

## 2. Files touched in S5

**MODIFY:**
```
app/marketplace/marketplace-content.tsx   below-fold Reveal/Stagger (item grid, orders); .t-lift/.t-focus-ring;
                                          balance→AnimatedNumber (keep grouping); §4 :209 fix; §6 status strays.
                                          redeem RPC + confirm/gate logic FROZEN.
app/profile/profile-content.tsx           displayedCredits→AnimatedNumber (§5); below-fold Reveal/Stagger
                                          (badges grid); .t-focus-ring on edit/save/inputs; §6 strays.
                                          handleSaveProfile + setLanguage FROZEN.
```
**Do NOT touch:** `marketplace/page.tsx`, `profile/page.tsx`, the redeem RPC, profile-save mutation,
`lib/*`, `/ml`, Navbar/Footer.

---

## 3. Frozen logic (the S5 tripwires)

- **Redeem:** `handleRedeem` → `supabase.rpc("redeem_marketplace_item", {p_item_id: item.id})`, the
  `res.success`/`res.new_balance`/`res.error` handling, `setBalance`, `refreshOrders`, `router.refresh`,
  `ERROR_KEYS`, the confirm dialog + `gateUnlocked` gating — all byte-frozen. Restyle the surrounding cards/
  dialog chrome only.
- **Profile save:** `handleSaveProfile` → `supabase.from("profiles").update({full_name, operating_zone})`,
  edit-mode toggle, `setLanguage` server action — byte-frozen. Restyle the form chrome only; don't touch the
  inputs' bound state or submit.

---

## 4. The `:209` fix (S5-owned, tiny)

`marketplace-content.tsx:209`:
```tsx
{t("payoutBoostNote", { value: confirmItem.perk_value })}   // perk_value: number | null → tsc error
```
`next-intl` values don't accept `null`. Fix by coalescing (the block already renders only when
`perk_type === "payout_boost"`, so a fallback is never actually shown):
```tsx
{t("payoutBoostNote", { value: confirmItem.perk_value ?? 0 })}
```
No behavior change; clears the last standing tsc error. After this, **`npx tsc --noEmit` should be fully
clean** — a milestone for the rehaul.

---

## 5. Counter migrations (credits — KEEP grouping)

Both are credit values that today render grouped (`toLocaleString`), so the migrated `AnimatedNumber` must
**keep default grouping** (do NOT add `useGrouping:false` — that flag was S4-specific for `toFixed` currency).

- **Profile `displayedCredits`** — replace the hand-rolled `useState(0)` + animation with
  `<AnimatedNumber value={credits} />`. Profile credits sit near the top (above fold) → drive it like the S2
  impact counters (start at 0, set to `credits` once in view / on mount), or simply render `value={credits}`
  if the design wants an immediate settle. Reduced-motion: NumberFlow snaps to final natively. Remove the now-
  dead `displayedCredits` state + its effect once migrated (karpathy: real dead-code removal, in-lane).
- **Marketplace `balance`** (optional, recommended) — render the header balance via `<AnimatedNumber
  value={balance} />` so it animates down on redeem. Keep grouping. The `.toLocaleString()` in the confirm
  dialog can stay or migrate — low value; leave if it adds churn.

---

## 6. Off-palette strays (conscious calls)

The app already defines an **earthy status vocabulary** in globals.css (`.status-pending/.status-accepted/
.status-completed`). These strays use Tailwind defaults instead:

1. **Marketplace `STATUS_STYLES`** (amber/sky/emerald/red) for order statuses (pending/dispatched/delivered/
   cancelled).
2. **Profile L105/108** emerald/amber verification badge; **L284** `text-neutral-500` disabled field.

**Recommendation: align to palette tones** (terra/sand/sage/moss + `--destructive`, or reuse the `.status-*`
classes where semantics match) for cohesion — consistent with the S3 footer / S4 greeting stray fixes. **But
these are multi-shade status systems, so it's a *visible* change** → make it the taste-pass's deliberate call,
and record the exact mapping in the checkpoint. `text-neutral-500 → text-smoke` is a safe one-liner. Default:
align; if the taste pass judges the semantic differentiation worth keeping, leave and record why.

Everything that looks like `#RRGGBB` hex here is the palette — leave.

---

## 7. Motion application map

Both pages are **auth-gated** (household). Content near the top (marketplace header/balance, profile
header/avatar/credits) is above the fold → keep CSS entrances. Reveal/Stagger the below-fold blocks.

| Surface | Fold | Motion |
|---|---|---|
| Marketplace header + balance | above | Keep CSS; balance via `<AnimatedNumber>` (§5) |
| Marketplace tier/item grid | mostly below | `<Stagger>` the item cards (`<StaggerItem className=…>`, DOM-preserving) |
| My Redemptions (orders) | below | `<Reveal>` the section; `<Stagger>` rows optional |
| Confirm dialog | overlay | Keep dialog's own animation; do NOT `<Reveal>` |
| Profile header/avatar/credits | above | Keep `animate-fadeIn`; credits via `<AnimatedNumber>` |
| Profile edit form | above/mid | `.t-focus-ring` on inputs/buttons; keep CSS entrance |
| Profile badges grid | below | `<Stagger>` the badge tiles |

**Reduced-motion:** primitives no-op to final; NumberFlow snaps to final natively.

---

## 8. i18n

Reuse `marketplace` + `profile` namespaces exactly. No new keys for existing copy.

---

## 9. Verification (S5 gate)

1. **`npx tsc --noEmit` FULLY clean** — with the §4 fix, the last pre-existing error is gone. Confirm zero errors.
2. **Auth-gated** — both pages redirect to `/login` without a household session; Playwright needs a logged-in
   session, or verify manually on dev. Note it in the report.
3. **Redeem smoke test (critical):** open an affordable item → confirm → redeem; balance decrements, a new
   order appears in My Redemptions, success toast fires. A locked item shows the correct lockReason. The RPC
   path is untouched — prove it still works end-to-end.
4. **Profile-save smoke test:** enter edit mode, change name/zone, save → `profiles.update` persists, UI
   reflects it; language switch still works.
5. **Counters:** profile credits + marketplace balance animate with **grouping** (e.g. "1,234"), none
   stranded at 0; reduced-motion shows finals.
6. **No CLS/overflow; above-fold content not stranded.**
7. **Skill pipeline** + one reconciliation; record the §5 (balance optional) and §6 (stray mapping) decisions.

---

## 10. Risk register

| Risk | Mitigation |
|---|---|
| Redeem RPC flow disturbed | Restyle chrome only; `redeem_marketplace_item`, result handling, gate frozen; §3 smoke test. |
| Profile-save mutation disturbed | `handleSaveProfile`/`update`/edit-toggle/`setLanguage` frozen; §4 smoke test. |
| Credit counter loses grouping (shows "1234" not "1,234") | Keep default grouping — do NOT add `useGrouping:false` (that was S4 currency-only). |
| `:209` fix changes behavior | `?? 0` is an unreachable fallback (guarded by `perk_type`); pure type fix. |
| Status-badge stray fix over-reaches | It's a visible change → taste-pass's deliberate call; `neutral-500→smoke` is the only safe auto-fix. |
| Above-fold flash on balance/credits | Keep CSS entrances above fold; Reveal/Stagger below only. |
| Auth gate blocks verification | Logged-in session for Playwright, or manual dev check; note in report. |
| `displayedCredits` removal breaks something | Remove state + effect together only after `<AnimatedNumber>` replaces the render; tsc + visual check. |

---

## 11. Implementation order (once approved)
0. `/frontend-design` for the grid/section rhythm within frozen tokens.
1. **`marketplace-content.tsx:209` fix first** (`?? 0`) → run `npx tsc --noEmit` → confirm FULLY clean (milestone).
2. `marketplace-content.tsx` — `<Stagger>` item grid, `<Reveal>` orders; balance→AnimatedNumber (grouping);
   `.t-lift`/`.t-focus-ring`; §6 status mapping (taste call). Redeem/confirm/gate logic frozen.
3. `profile-content.tsx` — `displayedCredits`→AnimatedNumber (remove dead state/effect); `<Stagger>` badges;
   `.t-focus-ring` on form; §6 strays. Save/setLanguage frozen.
4. `npx tsc --noEmit` (fully clean) → authed/manual Playwright of `/marketplace` + `/profile` → redeem +
   profile-save smoke tests → counter grouping + reduced-motion → no-CLS.
5. Hand off to VS Code skills: `/gpt-taste` → `/impeccable` → `/ui-ux-pro-max` + `/karpathy-guidelines`; one reconciliation.

**Two tripwires: the redeem RPC and the profile-save mutation. Restyle around both; change only presentation.**
