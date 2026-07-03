"use client";

import * as React from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  MOTION,
  ensureRegistered,
  useIsomorphicLayoutEffect,
  useMotion,
} from "./gsap-provider";

export interface RevealProps {
  children: React.ReactNode;
  /** Element to render. Default 'div'. */
  as?: React.ElementType;
  /** Rise distance in px. Default 24 (matches --motion-rise). */
  rise?: number;
  /** Delay before the reveal, in seconds. */
  delay?: number;
  /** Play once (default) or replay each time it re-enters the viewport. */
  once?: boolean;
  className?: string;
}

/**
 * Reveal-on-scroll wrapper: fades + rises its children when they enter the
 * viewport, eased with the signature "botanical" curve. Under reduced motion it
 * renders children in their final state with no ScrollTrigger.
 */
export function Reveal({
  as: Tag = "div",
  rise = MOTION.rise,
  delay = 0,
  once = true,
  className,
  children,
}: RevealProps) {
  const { reduced } = useMotion();
  const ref = React.useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (reduced || !el) return;
    ensureRegistered();

    const ctx = gsap.context(() => {
      // set-then-to (not gsap.from): a from-tween re-applies its hidden state on
      // React's dev double-invoke and on ScrollTrigger.refresh, leaving elements
      // stuck hidden. Setting the hidden state once and tweening to natural only
      // on viewport entry is immune to that.
      gsap.set(el, { opacity: 0, y: rise });
      const reveal = () =>
        gsap.to(el, { opacity: 1, y: 0, duration: MOTION.base, delay, ease: MOTION.ease });
      const st = ScrollTrigger.create({ trigger: el, start: "top 85%", once, onEnter: reveal });
      // Already past the start when created (short page / above the fold): reveal now.
      if (st.progress > 0) reveal();
    }, el);
    return () => ctx.revert();
  }, [reduced, rise, delay, once]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
