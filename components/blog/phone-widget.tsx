"use client";

import * as React from "react";
import { Pause, Play } from "lucide-react";
import { useMotion } from "@/components/motion/gsap-provider";
import { PHONE_MEDIA } from "@/lib/blog-content";
import { cn } from "@/lib/utils";

/**
 * CSS phone frame around the looping walkthrough timelapse. The inner screen is
 * locked to the video's 638:1382 aspect so the box is reserved before the video
 * loads (no layout shift) and `object-cover` never letterboxes.
 *
 * Reduced motion: no autoplay — the poster shows, with an opt-in play/pause
 * button. Sources attach only once the widget nears the viewport (lazy).
 */
export function PhoneWidget({ className }: { className?: string }) {
  const { reduced } = useMotion();
  const frameRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [inView, setInView] = React.useState(false);
  const [optedIn, setOptedIn] = React.useState(false);

  // Lazy-load: mount the <source>s only when the widget nears the viewport.
  React.useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Sources mount after the <video> itself, so re-scan them; autoplay only
  // when motion is allowed. Under reduced motion the video stays paused on
  // the poster until the user opts in.
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v || !inView) return;
    if (reduced) {
      v.pause();
      return;
    }
    if (!v.currentSrc) v.load();
    v.play().catch(() => {});
  }, [inView, reduced]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (!v.currentSrc) v.load();
      v.play().catch(() => {});
      setOptedIn(true);
    } else {
      v.pause();
      setOptedIn(false);
    }
  };

  return (
    <div ref={frameRef} className={cn("relative mx-auto w-60 sm:w-72", className)}>
      {/* Bezel — bark body, terra accent ring, soft grounded shadow */}
      <div className="relative rounded-[2.75rem] border border-terra/30 bg-bark p-2 shadow-[0_28px_60px_-24px_rgba(42,34,24,0.55)]">
        <div className="relative aspect-[638/1382] overflow-hidden rounded-[2.25rem] bg-bark">
          <video
            ref={videoRef}
            muted
            loop
            playsInline
            autoPlay={!reduced}
            preload={reduced ? "none" : "metadata"}
            poster={PHONE_MEDIA.poster}
            className="absolute inset-0 h-full w-full object-cover"
            aria-label="Silent walkthrough of the Trashium app"
          >
            {inView && (
              <>
                <source src={PHONE_MEDIA.webm} type="video/webm" />
                <source src={PHONE_MEDIA.mp4} type="video/mp4" />
              </>
            )}
          </video>

          {/* Notch pill, above the video */}
          <div
            aria-hidden
            className="absolute left-1/2 top-3 h-1.5 w-16 -translate-x-1/2 rounded-full bg-linen/25"
          />

          {/* Reduced-motion opt-in control */}
          {reduced && (
            <button
              type="button"
              onClick={toggle}
              className="t-focus-ring absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-linen/90 px-4 py-2 font-[family-name:var(--font-syne)] text-xs font-semibold text-bark shadow-lg"
            >
              {optedIn ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Play walkthrough
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
