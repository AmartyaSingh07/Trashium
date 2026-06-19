'use client';

import { useEffect, useState } from 'react';
import { KineticTypographyLoader } from '@/components/ui/loading-animation';

const SESSION_KEY = 'trashium:splash-shown';

/**
 * SiteLoadGate
 * ────────────
 * One-time first-open splash. Renders the kinetic loader over the whole site on
 * the initial visit, then fades it out once the app has mounted/hydrated.
 *
 * - Shown at most once per browser session (sessionStorage flag), so it does NOT
 *   reappear on every in-app navigation.
 * - Mounts nothing on subsequent visits — zero overhead after the first paint.
 * - Reduced-motion users get a short, static hold rather than the 3D throws
 *   (the loader component itself already honors prefers-reduced-motion).
 */
export default function SiteLoadGate() {
  // `null` = undecided (first render, pre-hydration). We start hidden to avoid
  // a flash for returning users, then decide in the effect.
  const [show, setShow] = useState<boolean | null>(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const alreadyShown =
      typeof window !== 'undefined' &&
      window.sessionStorage?.getItem(SESSION_KEY) === '1';

    if (alreadyShown) {
      setShow(false);
      return;
    }

    setShow(true);
    try {
      window.sessionStorage?.setItem(SESSION_KEY, '1');
    } catch {
      /* sessionStorage may be unavailable (private mode) — splash still works */
    }

    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Hold for one comfortable beat after hydration, then fade.
    const holdMs = prefersReducedMotion ? 700 : 1400;
    const fadeId = setTimeout(() => setFadeOut(true), holdMs);
    // Unmount after the fade transition (0.5s) completes.
    const removeId = setTimeout(() => setShow(false), holdMs + 600);

    return () => {
      clearTimeout(fadeId);
      clearTimeout(removeId);
    };
  }, []);

  if (!show) return null;

  return <KineticTypographyLoader fadeOut={fadeOut} />;
}
