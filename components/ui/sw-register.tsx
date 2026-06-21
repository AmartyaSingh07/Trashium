"use client";

import { useEffect } from "react";

/**
 * Service worker lifecycle manager.
 *
 * PRODUCTION: registers /sw.js and keeps it fresh (auto-reloads once when a new
 * version takes control), so code changes always reach users.
 *
 * DEVELOPMENT: does the OPPOSITE — it unregisters any existing service worker
 * and clears its caches. A dev-time SW caches Next's JS chunks and serves stale
 * code, which makes edits appear to "not work" no matter how often you refresh.
 * Keeping the SW out of dev removes that whole class of problem. PWA install
 * still works locally because installability is driven by the manifest +
 * localhost being a secure context, not by the SW being registered in dev.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isProd = process.env.NODE_ENV === "production";

    if (!isProd) {
      // Tear down any SW + caches left over from earlier dev sessions so stale
      // cached JS can never shadow new code during local development.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if (typeof caches !== "undefined") {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }

    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        reg.update().catch(() => {});
      } catch (err) {
        console.warn("SW registration failed:", err);
      }
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
