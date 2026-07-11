'use client';

import React, { useEffect, useRef } from 'react';

/**
 * KineticTypographyLoader
 * ───────────────────────
 * A full-screen kinetic-typography loader. Each phrase's characters fly in
 * from random 3D positions, hold, then fly back out as the next phrase enters.
 *
 * Trashium-themed defaults narrate the waste-to-worth pipeline. Pass a custom
 * `words` array to override.
 *
 * Accessibility: respects `prefers-reduced-motion` — when reduced motion is
 * requested, characters are placed statically (no 3D throws) and phrases simply
 * cross-fade via opacity.
 */

const TRASHIUM_PHRASES = [
  'SEGREGATING',
  'UPCYCLING',
  'CALCULATING PAYOUT',
  'PLANTING SEEDS',
  'SAVING PLANETS',
] as const;

export interface KineticTypographyLoaderProps {
  /** Phrases to cycle through. Defaults to the Trashium pipeline narration. */
  words?: readonly string[];
  /** Optional accessible label for screen readers. */
  label?: string;
  /** When true, the overlay fades out (used by the first-open splash gate). */
  fadeOut?: boolean;
}

export const KineticTypographyLoader: React.FC<KineticTypographyLoaderProps> = ({
  words = TRASHIUM_PHRASES,
  label = 'Loading',
  fadeOut = false,
}) => {
  const loaderTextRef = useRef<HTMLHeadingElement | null>(null);
  const wordIndexRef = useRef(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const loaderText = loaderTextRef.current;
    if (!loaderText) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const timeouts = timeoutsRef.current;
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timeouts.push(id);
      return id;
    };

    const rand = (range: number) => (Math.random() - 0.5) * range;

    function buildChar(char: string, index: number): HTMLSpanElement {
      const span = document.createElement('span');
      span.textContent = char;

      // Preserve spaces as non-animated gaps so multi-word phrases read correctly.
      if (char === ' ') {
        span.className = 'char char--space';
        span.innerHTML = '&nbsp;';
        return span;
      }

      span.className = 'char';

      if (prefersReducedMotion) {
        // No 3D throw — just fade the phrase in.
        span.style.opacity = '1';
        return span;
      }

      span.style.setProperty(
        '--transform-from',
        `translate3d(${rand(800)}px, ${rand(800)}px, ${rand(800)}px) rotateX(${rand(
          360,
        )}deg) rotateY(${rand(360)}deg)`,
      );
      span.style.animationName = 'fly-in';
      span.style.animationDelay = `${index * 0.05}s`;
      span.style.animationPlayState = 'running';
      return span;
    }

    function animateWord() {
      const node = loaderTextRef.current;
      if (!node) return;

      const word = words[wordIndexRef.current];
      node.innerHTML = '';

      const chars = word.split('').map((char, index) => {
        const span = buildChar(char, index);
        node.appendChild(span);
        return span;
      });

      if (prefersReducedMotion) {
        // Cross-fade pacing: hold then advance.
        schedule(() => {
          wordIndexRef.current = (wordIndexRef.current + 1) % words.length;
          animateWord();
        }, 1800);
        return;
      }

      // Fly the characters back out before the next phrase enters.
      schedule(() => {
        chars.forEach((span, index) => {
          if (span.classList.contains('char--space')) return;
          span.style.setProperty(
            '--transform-to',
            `translate3d(${rand(800)}px, ${rand(800)}px, ${rand(800)}px) rotateX(${rand(
              360,
            )}deg) rotateY(${rand(360)}deg)`,
          );
          span.style.animationName = 'fly-out';
          span.style.animationDelay = `${(chars.length - index) * 0.05}s`;
        });
      }, 2500);

      schedule(() => {
        wordIndexRef.current = (wordIndexRef.current + 1) % words.length;
        animateWord();
      }, 3500);
    }

    animateWord();

    return () => {
      timeouts.forEach(clearTimeout);
      timeoutsRef.current = [];
    };
  }, [words]);

  return (
    <div
      className={`loader-container${fadeOut ? ' loader-container--out' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Soft terra glow behind the type for depth on the bark backdrop */}
      <div className="loader-glow" aria-hidden="true" />
      <h1
        ref={loaderTextRef}
        aria-hidden="true"
        className="loader-text font-syne text-3xl font-extrabold whitespace-nowrap px-4 sm:text-5xl lg:text-7xl"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
};

export default KineticTypographyLoader;
