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

export interface StaggerProps {
  children: React.ReactNode;
  /** Element to render as the container. Default 'div'. */
  as?: React.ElementType;
  /** Cadence between items, in seconds. Default 0.08 (matches --motion-stagger). */
  interval?: number;
  /** Rise distance in px. Default 24 (matches --motion-rise). */
  rise?: number;
  className?: string;
}

export interface StaggerItemProps {
  children: React.ReactNode;
  /** Element to render as the item. Default 'div'. */
  as?: React.ElementType;
  className?: string;
}

/**
 * Staggered group reveal: one ScrollTrigger on the container reveals each
 * <StaggerItem> in sequence on the "botanical" ease. Reduced motion → all items
 * render in their final state at once.
 */
export function Stagger({
  as: Tag = "div",
  interval = MOTION.stagger,
  rise = MOTION.rise,
  className,
  children,
}: StaggerProps) {
  const { reduced } = useMotion();
  const ref = React.useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (reduced || !el) return;
    // Targets ALL descendant [data-stagger-item]s, so a Stagger must not be nested inside another.
    const items = el.querySelectorAll<HTMLElement>("[data-stagger-item]");
    if (!items.length) return;
    ensureRegistered();

    const ctx = gsap.context(() => {
      // set-then-to (not gsap.from): see reveal.tsx — a from-tween re-applies its
      // hidden state on React's dev double-invoke and on ScrollTrigger.refresh,
      // stranding items hidden. Reveal only on real viewport entry.
      gsap.set(items, { opacity: 0, y: rise });
      const reveal = () =>
        gsap.to(items, {
          opacity: 1,
          y: 0,
          duration: MOTION.base,
          ease: MOTION.ease,
          stagger: interval,
        });
      const st = ScrollTrigger.create({ trigger: el, start: "top 85%", once: true, onEnter: reveal });
      if (st.progress > 0) reveal();
    }, el);
    return () => ctx.revert();
  }, [reduced, interval, rise]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/** A single item within a <Stagger>. Marked so the container can target it. */
export function StaggerItem({
  as: Tag = "div",
  className,
  children,
}: StaggerItemProps) {
  return (
    <Tag data-stagger-item className={className}>
      {children}
    </Tag>
  );
}
