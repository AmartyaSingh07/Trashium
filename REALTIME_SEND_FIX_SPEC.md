# Post-Rehaul Fix Spec — Crew GPS `send()` → REST fallback

> **Standalone task. NOT part of the UI/UX rehaul.** This is a functional/realtime change to
> `app/crew/crew-content.tsx`. Resolves `KNOWN_ISSUES.md` #1. Small, isolated, no dependency bump.
> The rehaul (S1–S6) is complete; this was deliberately deferred until after it.

---

## What & why

**Symptom (dev terminal):**
> `Realtime send() is automatically falling back to REST API. This behavior will be deprecated in the future. Please use httpSend() explicitly for REST delivery.`

**Root cause.** In the GPS Telemetry effect, `channel.subscribe()` joins the WebSocket **asynchronously**,
while `navigator.geolocation.watchPosition` separately calls `channel.send({type:"broadcast", …})`. A GPS
position can arrive **before** the socket has joined, so `send()` can't use the WebSocket and realtime-js
silently falls back to an HTTP POST — the path that logs this warning.

**Why fix it.** (1) Future-proofing — Supabase will remove the auto-REST fallback in a future
`@supabase/realtime-js`; ungated pre-join `send()` calls could then fail. (2) Latency — live telemetry
belongs on the WebSocket (the code even calls it a "zero-overhead WebSocket channel"); REST is a fresh HTTP
round-trip per ping.

**Chosen fix.** Gate `send()` on the channel being `SUBSCRIBED`, using a closure flag both callbacks share.
Keeps telemetry on the WebSocket, removes the warning, needs no dependency bump. (The explicit `httpSend()`
alternative needs `@supabase/supabase-js ≥ 2.107.0` — project is on 2.105.3 — and isn't what we want anyway,
since REST is the wrong transport for live tracking.)

---

## The change (single file: `app/crew/crew-content.tsx`, the GPS Telemetry effect ~L89–130)

**Before:**
```tsx
    const channel = supabase.channel(`tracking:${zone}`);
    trackingChannelRef.current = channel;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setIsBroadcasting(true);
      }
    });

    let watchId: number | undefined;

    if (typeof window !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          channel.send({
            type: "broadcast",
            event: "telemetry_ping",
            payload: { /* … unchanged … */ },
          });
        },
        (err) => { /* … unchanged … */ },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(channel);
      trackingChannelRef.current = null;
      setIsBroadcasting(false);
    };
```

**After** (three added lines, marked):
```tsx
    const channel = supabase.channel(`tracking:${zone}`);
    trackingChannelRef.current = channel;

    // Gate broadcasts on the WS channel having joined. send() before SUBSCRIBED
    // falls back to a REST POST (deprecated) — skip those early pings; the next
    // GPS fix arrives in ~3s. Any non-SUBSCRIBED status flips this back off.
    let isJoined = false;                                    // + added

    channel.subscribe((status) => {
      isJoined = status === "SUBSCRIBED";                    // + added
      if (status === "SUBSCRIBED") {
        setIsBroadcasting(true);
      }
    });

    let watchId: number | undefined;

    if (typeof window !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!isJoined) return;                             // + added — WS-only; no REST fallback
          channel.send({
            type: "broadcast",
            event: "telemetry_ping",
            payload: { /* … unchanged … */ },
          });
        },
        (err) => { /* … unchanged … */ },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(channel);
      trackingChannelRef.current = null;
      setIsBroadcasting(false);
    };
```

**Notes.**
- `isJoined` is a plain closure variable — both the `subscribe` callback and the `watchPosition` callback are
  created in the same effect run and close over it, so the guard reads live updates. No `useRef` needed.
- `isJoined = status === "SUBSCRIBED"` also flips **off** on `CLOSED`/`CHANNEL_ERROR`/`TIMED_OUT`, so a
  dropped socket won't REST-fallback either.
- Behavior preserved: `setIsBroadcasting(true)` on join and the cleanup are unchanged. The only functional
  change is that pre-join (and post-drop) pings are skipped rather than sent over REST.
- Do **not** touch anything else in the effect (payload shape, `watchPosition` options, `removeChannel`).

---

## Verification

1. `npx tsc --noEmit` — stays fully clean.
2. Dev, logged in as **crew/collector** with **GPS permission** on `/crew`: the
   `Realtime send() … falling back to REST` warning **no longer logs**.
3. Telemetry still flows: open `/dashboard/tracking` as a household in the same zone → the crew marker still
   moves / overlay updates (broadcasts now go over the WebSocket).
4. First fix latency: telemetry may start one GPS tick (~3s) later than before — expected and harmless.
5. No other console errors; `setIsBroadcasting` still toggles the crew "broadcasting" UI on join.

---

## VS Code paste-prompt

```
Standalone functional fix (NOT a restyle) — resolve KNOWN_ISSUES.md #1. Read REALTIME_SEND_FIX_SPEC.md first.

In app/crew/crew-content.tsx, in the GPS Telemetry Broadcast useEffect (~L89–130), gate channel.send() on
the channel being SUBSCRIBED so telemetry stays on the WebSocket and never REST-falls-back:
- add `let isJoined = false;` after trackingChannelRef.current = channel;
- in the subscribe callback set `isJoined = status === "SUBSCRIBED";` (keep the existing setIsBroadcasting(true));
- as the first line of the watchPosition success callback, add `if (!isJoined) return;` before channel.send(...).

Change NOTHING else — payload shape, watchPosition options, removeChannel/cleanup all unchanged. No dependency
bump (do NOT introduce httpSend(); it needs supabase-js ≥2.107.0 and REST is the wrong transport for live GPS).

Verify: npx tsc --noEmit fully clean → on dev as crew with GPS permission, the "Realtime send() falling back to
REST" warning is gone → household on /dashboard/tracking still sees the crew marker move (WS broadcast intact).
Stop and report.
```
