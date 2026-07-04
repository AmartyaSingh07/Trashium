# T3_B6 — Build handoff: make the crew incident report + offline lock honest

> Verified live this session. Locked to recommended decisions. Code → Fable (paste §3).
> Lowest-effort of the Tier 3 items. No DB migration.

---

## §0 Live facts verified (one is milder than the audit said)

- **`handleReportIssue` (`crew-content.tsx:179-184`)** toasts `"Incident report dispatched
  successfully."`, clears the text, closes the modal — and **persists nothing**. Confirmed fiction.
- **Offline lock (`crew-content.tsx:154-157`)** — inside `updatePickupStatus`, when `isOffline`
  it shows a toast and **`return`s early, actually blocking the write**. So the *behavior is
  already honest* (it blocks). Only the **copy lies**: "Cached mutations commit immediately upon
  reconnection." — nothing is cached. → **Fix is copy-only.**
- **`pickup_requests.notes`** (text, nullable) exists — a natural place to persist a report with
  no schema change.

---

## §1 Locked decisions (recommended)

1. **Persist the incident report** by appending to `pickup_requests.notes` (timestamped), then
   the success toast becomes truthful.
2. **Offline: fix the copy only** — the block already works. New message states changes are
   blocked until reconnect; drop the false "cached/commit on reconnection" claim.

---

## §2 Files / DB touched

- `app/crew/crew-content.tsx` — `handleReportIssue` (persist) + the offline toast string (L155).
- i18n: if these strings are localized, add/adjust keys in en/hi/bn; otherwise inline copy.
- No DB migration (uses existing `notes`).

---

## §3 Fable prompt (paste into the VS Code extension)

> Context: Trashium (Next.js 16 / React 19). Do NOT touch realtime channels, GPS gating, the
> Leaflet map, or ML pricing. Keep `npx tsc --noEmit` green. Use the existing Supabase browser
> client already in this client component. Reuse i18n keys where the surrounding code does.

**1. Persist the incident report — `handleReportIssue` (L179-184).** Make it async and append the
report to the selected pickup's `notes`, then toast only on a real write:
```ts
const handleReportIssue = async () => {
  if (!issueText.trim() || !selectedPickup) return;
  const stamp = new Date().toISOString();
  const prefix = selectedPickup.notes ? selectedPickup.notes + "\n" : "";
  const entry = `[INCIDENT ${stamp}] ${issueText.trim()}`;
  const { error } = await supabase
    .from("pickup_requests")
    .update({ notes: prefix + entry })
    .eq("id", selectedPickup.id);
  if (error) {
    toast.error("Could not save the incident report. Please try again.");
    return;
  }
  // keep local state in sync
  setPickups(prev => prev.map(p => p.id === selectedPickup.id ? { ...p, notes: prefix + entry } : p));
  setSelectedPickup(prev => prev ? { ...prev, notes: prefix + entry } : prev);
  toast.success("Incident report saved.");
  setIssueText("");
  setIsActionModalOpen(false);
};
```
(If the offline lock should also gate reporting, add the same `if (isOffline) { toast.error(...); return; }`
guard at the top — recommended for consistency.)

**2. Honest offline copy — L155.** Replace
`"Operational offline safe-lock active. Cached mutations commit immediately upon reconnection."`
with something truthful, e.g.
`"You're offline — changes are blocked until you reconnect."`
(Do not change the `return` — the block is correct; only the wording was false.)

**Verify:** `npx tsc --noEmit` clean; submitting a report writes a timestamped line into that
pickup's `notes` (check the row); the offline toast no longer claims caching; toggling devtools
offline still blocks status updates.

---

## §4 Risks / notes

- **`notes` concurrency:** two rapid appends can read-modify-write clobber. Fine at demo scale;
  if it matters later, move to a dedicated `incident_reports` table (out of scope now).
- **i18n:** if strings are localized, a missing key renders raw — add all three locales.
- **Scope:** do NOT build a real offline mutation queue — honest copy is the goal.
