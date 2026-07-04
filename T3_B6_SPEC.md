# T3_B6_SPEC — Make the crew incident report + offline safe-lock honest

> Tier 3 build spec. Implemented in the VS Code Claude Code extension ("Fable").
> **Specs only — no code/DB changes until the user approves.** Lowest-effort of the five.

---

## §0 Goal & non-goals

**Goal.** Two crew features currently *claim* to do things they don't — a violation of the
project's "no fiction" rule. Fix each by **either** making it real **or** relabeling it
honestly:
1. **Incident report** — `handleReportIssue` toasts "success" but persists nothing.
2. **Offline safe-lock** — an `alert()` claims "cached mutations commit on reconnection" but
   nothing is cached.

**Non-goals.**
- No real offline sync engine / mutation queue (that would be a large project). If we keep
  offline handling, it's an *honest label*, not a real cache.
- No change to realtime channels, GPS gating, or the Leaflet map.
- No crew-workflow redesign beyond these two touchpoints.

---

## §1 Verified current state (from audit; re-confirm before building)

- **`app/crew/crew-content.tsx`** — `handleReportIssue` shows a success toast **without any
  write** (no Supabase insert/update).
- Same file — an offline branch calls `alert()` stating cached mutations will commit on
  reconnection; **no caching exists** (no queue, no local persistence).

> ⚠️ **Implementer must read `crew-content.tsx`** to confirm both call sites, the current toast
> / alert copy, whether a `notes` column exists on `pickup_requests`, and how the crew view
> already writes (to reuse the correct Supabase browser client + realtime-safe pattern).

---

## §2 Files / DB touched

**Code (one file):**
- `app/crew/crew-content.tsx` — `handleReportIssue` and the offline branch.

**DB — only if we choose to persist incidents:**
- Option A: append to an existing `pickup_requests.notes` column (confirm it exists; no schema
  change if so).
- Option B: a small new `incident_reports` table (`id`, `pickup_id`/`user_id`, `body`,
  `created_at`). If created, mirror into `supabase_schema.sql` and note RLS stays **off** in
  dev (consistent with the current decision; hardening deferred to the deploy checklist).

**i18n:** reuse existing keys where possible; any new honest-label copy adds keys across
en/hi/bn (~309-key set) — keep additions minimal.

---

## §3 Approach + the frozen bits

**Incident report — two honest paths:**
- **Persist (recommended if cheap):** write the report. Simplest is appending to
  `pickup_requests.notes` (timestamp + crew id + text); a dedicated `incident_reports` table
  is cleaner but adds a table. On success, the existing toast becomes truthful.
- **Relabel:** if we don't persist now, change the toast/CTA to "Reporting coming soon" (or
  disable the control) so it stops claiming a save that didn't happen.

**Offline safe-lock — honest label:**
- Replace the false "cached mutations commit on reconnection" `alert()` with an accurate
  message, e.g. "You're offline — changes are blocked until you reconnect," and actually
  **block** the mutation while offline (guard the write) rather than pretending to queue it.

**Frozen — do not touch:** realtime channels + crew GPS gating (`isJoined === SUBSCRIBED`);
the Leaflet map island; ML pricing. Theme frozen (toasts/labels use existing tokens + i18n).
Reduced-motion respected. Server/client split preserved. If persisting, use the correct
Supabase **browser** client from the client component.

---

## §4 Decision(s) needed

1. **Incident report: persist or relabel?**
   - Persist → **A) append to `pickup_requests.notes`** (no schema change if the column
     exists) or **B) new `incident_reports` table** (cleaner, one migration).
   - Relabel → "Reporting coming soon" / disable.
   **Recommendation: Persist via A (`notes` append)** — lowest effort that makes the toast
   true and keeps the "no fiction" rule; upgrade to B only if you want a queryable incident log
   for the demo.
2. **Offline handling: honest-block or remove?** Keep an accurate "offline — changes blocked"
   message (recommended) **or** remove the offline branch entirely if it's not demoed.
   Recommendation: **honest-block** — small, and it shows thoughtful UX.

---

## §5 Verification

- `npx tsc --noEmit` clean.
- **Persist path (crew role, manual):** submit an incident; confirm the row's `notes` (or an
  `incident_reports` row) actually contains the text + timestamp; the success toast now
  corresponds to a real write.
- **Relabel path:** confirm no toast/alert claims an action that didn't occur; copy exists in
  en/hi/bn.
- **Offline path:** simulate offline; confirm the mutation is actually blocked and the message
  is accurate (no "cached/queued" claim).
- **Frozen check:** diff shows no change to realtime/GPS gating, the map island, or pricing.
- If a table was added, mirror into `supabase_schema.sql`.

> Auth-gating: crew role session; offline simulation is a manual dev check (devtools offline).

---

## §6 Risks

- **Scope creep into a real sync engine.** Resist — the honest-label path is the point; a
  mutation queue is out of scope.
- **i18n gaps.** New copy must land in all three locales or a key shows raw. Keep new keys
  minimal and reuse existing ones.
- **`notes` append concurrency.** If two writers append, a naive read-modify-write can clobber.
  For demo scale it's fine; note it if choosing option A. Option B (separate rows) avoids it.
- **RLS.** New `incident_reports` table stays RLS-off in dev per current decision; add it to
  the deploy security checklist rather than enabling RLS now.

---

## §7 Implementation order

1. Read `crew-content.tsx`; confirm both call sites, current copy, and whether `notes` exists.
2. Decide persist-vs-relabel (§4.1) and offline honest-block-vs-remove (§4.2).
3. Implement the chosen incident path (write + truthful toast, or relabel).
4. Fix the offline branch (accurate message + real block).
5. Add any new i18n keys (en/hi/bn); if a table was added, mirror to schema SQL.
6. `tsc` green + manual crew verification.
