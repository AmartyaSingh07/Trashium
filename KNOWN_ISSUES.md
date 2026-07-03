# Known Issues & Follow-ups

Standalone tracker for issues that are **not** part of the UI/UX rehaul (S1–S6). The rehaul is
presentation-only; anything here is a functional/logic change and must be done as its own task,
**after** the rehaul is complete, so it never gets bundled into a restyle session.

---

## 1. Realtime `send()` falling back to REST (GPS telemetry) — ✅ RESOLVED (2026-07-03)

**Status:** RESOLVED — `crew-content.tsx` GPS effect now gates `channel.send()` on `isJoined`
(`status === "SUBSCRIBED"`), so telemetry stays on the WebSocket and never REST-falls-back. Verified
in-file (L97/100/111) + `tsc` clean. Spec kept at `REALTIME_SEND_FIX_SPEC.md` for reference. No dep bump.
Manual confirm still worth doing on dev (crew + GPS): the REST warning should no longer log.

**Symptom (dev terminal):**
> `Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.`

**Where it comes from:** `app/crew/crew-content.tsx` (GPS Telemetry Broadcast, ~L85–129).
The channel is created and `channel.subscribe()` is called (async WebSocket join), while
`navigator.geolocation.watchPosition` separately calls `channel.send({ type: "broadcast", … })`.
Because `send()` is **not gated on the channel being `SUBSCRIBED`**, a GPS position that arrives
before the socket has joined can't use the WebSocket, so realtime-js silently falls back to an
HTTP POST — the path that now logs this warning.

Related realtime usage (for context, not broken): `app/dashboard/tracking/tracking-content.tsx`
(listens for `telemetry_ping`), `app/admin/admin-content.tsx` (`postgres_changes` subscription).

**Is it a problem right now?** No. It's a deprecation warning; the broadcast is still delivered
(over REST), so live tracking works. Two reasons to fix it eventually:
1. **Future-proofing** — Supabase will remove the automatic REST fallback in a future
   `@supabase/realtime-js` release; ungated `send()` calls made before the join could then fail.
2. **Latency** — for live GPS telemetry the WebSocket path is the intended one (the code comment
   even calls it a "zero-overhead WebSocket channel"); REST is a fresh HTTP round-trip per ping.

**Version note:** the explicit `httpSend()` method exists from `@supabase/supabase-js` **2.107.0+**.
This project is on **2.105.3** (see `package.json`), so `httpSend()` isn't available yet — a bump
is required before that option exists.

**Recommended fix (do this, not `httpSend`):** only broadcast once the channel is joined — move the
`watchPosition` setup inside the `if (status === "SUBSCRIBED")` branch of the `subscribe` callback,
or guard the `send()` with a "subscribed" ref. This keeps telemetry on the WebSocket, removes the
warning, and is future-proof. At most the first ping or two (before the join completes) are dropped,
which is harmless — the next position arrives in ~3s. Use `httpSend()` only if REST delivery is ever
actually intended (it isn't, for live tracking).

**Scope guard:** this touches realtime data flow — treat it like the ML quote and the redeem RPC:
**do not** fold it into S6's restyle. It is a separate follow-up for after the rehaul is finished.

**Reference:** [supabase/ssr#161](https://github.com/supabase/ssr/issues/161) ·
[Supabase Realtime Broadcast docs](https://supabase.com/docs/guides/realtime/broadcast)
