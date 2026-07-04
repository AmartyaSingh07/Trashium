"use client";

import * as React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CustomEase } from "gsap/CustomEase";

// ── Shared GSAP setup ────────────────────────────────────────────────────────
// Module-level guard so ScrollTrigger + CustomEase register exactly once — even
// across HMR or if several primitives mount before the provider's effect runs
// (React fires child effects before parent effects, so registration cannot live
// only in the provider effect). Browser-only; SSR skips it.
let registered = false;
export function ensureRegistered() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, CustomEase);
  // Mirror --ease-botanical: cubic-bezier(0.22, 1, 0.36, 1) so JS reveals feel
  // identical to the CSS .t-lift / t-rise transitions. Single source for the ease.
  CustomEase.create("botanical", "M0,0 C0.22,1 0.36,1 1,1");
  registered = true;
}

// JS mirror of the globals.css --motion-* / --ease-botanical tokens. GSAP can't
// read CSS custom-property easings/durations directly, so the primitives share
// this one object. Keep in sync with the token block in globals.css.
export const MOTION = {
  fast: 0.4,
  base: 0.7,
  slow: 1.1,
  rise: 24,
  riseSm: 12,
  stagger: 0.08,
  ease: "botanical",
} as const;

// useLayoutEffect on the client (no pre-paint flash), useEffect on the server
// (avoids the SSR warning). Primitives use this to set initial hidden state.
export const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

// ── Motion context ───────────────────────────────────────────────────────────
export interface MotionState {
  /** True when the user prefers reduced motion — primitives render final-state, no tweens. */
  reduced: boolean;
}

// Default reduced=true: a primitive rendered outside the provider fails safe to
// the accessible, final-state (no-animation) branch instead of animating.
export const MotionContext = React.createContext<MotionState>({ reduced: true });

export function useMotion(): MotionState {
  return React.useContext(MotionContext);
}

function prefersReduced(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Mounts the GSAP + ScrollTrigger foundation once, client-side, and publishes the
 * reduced-motion flag every motion primitive consumes. Returns {children} directly
 * (no wrapper DOM), so the rendered tree is byte-for-byte identical to no provider.
 */
export default function GsapProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [reduced, setReduced] = React.useState(prefersReduced);

  React.useEffect(() => {
    ensureRegistered();

    // Keep the flag live if the user toggles the OS setting mid-session.
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the reduced-motion flag from matchMedia (external system) before subscribing
    setReduced(mql.matches);
    mql.addEventListener("change", onChange);

    // Primitives create their triggers in child layout-effects, which run before
    // web fonts swap and before late-hydrated client sections settle — both reflow
    // the page and leave ScrollTrigger start positions stale (reveals then never
    // fire on scroll). Recalculate once things settle.
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);
    const settleTimer = window.setTimeout(refresh, 500);

    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("load", refresh);
      window.clearTimeout(settleTimer);
      // Safety net: tear down any triggers still alive when the provider unmounts.
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <MotionContext.Provider value={{ reduced }}>
      {children}
    </MotionContext.Provider>
  );
}
