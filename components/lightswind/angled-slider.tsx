"use client";

import Image from "next/image";

export interface AngledSliderItem {
  id: number | string;
  url: string;
  title: string;
}

interface AngledSliderProps {
  items: AngledSliderItem[];
  /** Seconds for one full loop of the track. Higher = slower. */
  speed?: number;
  className?: string;
}

/**
 * AngledSlider — infinite 3D-angled marquee with reflection + hover lift.
 * Lightswind-style API (`items`, `speed`), themed to the Trashium palette.
 *
 * - Pure CSS animation (no JS timers) → cheap, smooth, SSR-safe.
 * - Track is duplicated once and translated by -50% for a seamless loop.
 * - Pauses on hover; honours `prefers-reduced-motion` (rule 12).
 */
export function AngledSlider({ items, speed = 30, className = "" }: AngledSliderProps) {
  // Duplicate items so translating the track by -50% loops seamlessly.
  const loop = [...items, ...items];

  return (
    <div
      className={`ls-angled relative w-full overflow-hidden select-none ${className}`}
      aria-label="Trashium walkthrough carousel"
    >
      {/* Edge fades into the linen page background */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 sm:w-32 bg-gradient-to-r from-[var(--color-linen)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 sm:w-32 bg-gradient-to-l from-[var(--color-linen)] to-transparent" />

      <div className="ls-angled-plane pt-10 pb-20 sm:pb-24">
        {/* No flex gap here: per-card margin keeps the -50% loop seamless */}
        <div className="ls-angled-track flex w-max items-center">
          {loop.map((item, i) => (
            <figure
              key={`${item.id}-${i}`}
              className="ls-angled-card group relative shrink-0 mr-6 sm:mr-8"
              aria-hidden={i >= items.length}
            >
              <div className="relative w-[260px] sm:w-[380px] lg:w-[460px] overflow-hidden rounded-2xl border border-bark/10 bg-white/60 shadow-[0_18px_40px_-18px_rgba(42,34,24,0.35)] transition-shadow duration-500 group-hover:shadow-[0_28px_56px_-20px_rgba(194,112,61,0.45)]">
                <Image
                  src={item.url}
                  alt={item.title}
                  width={1400}
                  height={800}
                  className="block h-auto w-full"
                  sizes="(max-width: 640px) 260px, (max-width: 1024px) 380px, 460px"
                  priority={i < 3}
                />
              </div>
              {/* Reflection */}
              <div className="ls-angled-reflection pointer-events-none absolute left-0 top-full mt-1 w-full overflow-hidden rounded-2xl">
                <Image
                  src={item.url}
                  alt=""
                  width={1400}
                  height={800}
                  className="block h-auto w-full -scale-y-100"
                  sizes="(max-width: 640px) 260px, (max-width: 1024px) 380px, 460px"
                  priority={i < 3}
                />
              </div>
            </figure>
          ))}
        </div>
      </div>

      <style>{`
        .ls-angled-plane {
          perspective: 1400px;
        }
        .ls-angled-track {
          animation: ls-angled-scroll ${Math.max(8, speed)}s linear infinite;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .ls-angled:hover .ls-angled-track {
          animation-play-state: paused;
        }
        .ls-angled-card {
          transform: rotateY(-7deg) rotateX(3deg);
          transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ls-angled-card:hover {
          transform: rotateY(0deg) rotateX(0deg) translateY(-6px) scale(1.02);
          z-index: 10;
        }
        .ls-angled-reflection {
          opacity: 0.18;
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 45%);
          mask-image: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent 45%);
          filter: blur(1px) saturate(0.85);
        }
        @keyframes ls-angled-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ls-angled-track {
            animation: none;
          }
          .ls-angled-card,
          .ls-angled-card:hover {
            transform: none;
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}
