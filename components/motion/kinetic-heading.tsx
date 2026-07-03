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

export interface KineticHeadingProps {
  /** The heading text. Rendered as a real string for AT + SEO regardless of animation. */
  text: string;
  /** Split granularity for the reveal. Default 'word'. */
  splitBy?: "word" | "line";
  /** Element to render. Default 'h2'. */
  as?: React.ElementType;
  /** Delay before the reveal, in seconds. */
  delay?: number;
  className?: string;
}

/**
 * Editorial per-word (or per-line) reveal for Cormorant display headings: each
 * part rises with a slight skew settle on the signature "botanical" ease.
 *
 * Accessibility: the full plain string is always present (visually-hidden real
 * text carries the semantics); the animated split spans are aria-hidden. Under
 * reduced motion it renders the plain string with no split.
 */
export function KineticHeading({
  text,
  splitBy = "word",
  as: Tag = "h2",
  delay = 0,
  className,
}: KineticHeadingProps) {
  const { reduced } = useMotion();
  const ref = React.useRef<HTMLElement>(null);

  const parts = React.useMemo(
    () => (splitBy === "line" ? text.split("\n") : text.split(" ")),
    [text, splitBy],
  );

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (reduced || !el) return;
    const spans = el.querySelectorAll<HTMLElement>("[data-kinetic-part]");
    if (!spans.length) return;
    ensureRegistered();

    const ctx = gsap.context(() => {
      // set-then-to (not gsap.from): see reveal.tsx for why the from-tween strands
      // elements hidden under React double-invoke / ScrollTrigger.refresh.
      gsap.set(spans, { opacity: 0, y: MOTION.rise, skewY: 3, transformOrigin: "0% 100%" });
      const reveal = () =>
        gsap.to(spans, {
          opacity: 1,
          y: 0,
          skewY: 0,
          duration: MOTION.base,
          ease: MOTION.ease,
          delay,
          stagger: MOTION.stagger,
        });
      const st = ScrollTrigger.create({ trigger: el, start: "top 88%", once: true, onEnter: reveal });
      if (st.progress > 0) reveal();
    }, el);
    return () => ctx.revert();
  }, [reduced, delay, parts]);

  if (reduced) {
    return (
      <Tag ref={ref} className={className}>
        {text}
      </Tag>
    );
  }

  return (
    <Tag ref={ref} className={className}>
      {/* Real string for assistive tech + SEO */}
      <span className="sr-only">{text}</span>
      {/* Animated split, hidden from assistive tech */}
      <span aria-hidden="true">
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <span data-kinetic-part style={{ display: "inline-block" }}>
              {part}
            </span>
            {i < parts.length - 1 && (splitBy === "line" ? <br /> : " ")}
          </React.Fragment>
        ))}
      </span>
    </Tag>
  );
}
