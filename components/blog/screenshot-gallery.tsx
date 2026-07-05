"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { useMotion } from "@/components/motion/gsap-provider";
import { SCREENSHOTS, type BlogScreenshot } from "@/lib/blog-content";
import { cn } from "@/lib/utils";

/**
 * The six real product screenshots in a staggered glass-card grid, each opening
 * a lightbox overlay (React state only). Esc + backdrop click close; reduced
 * motion opens the overlay instantly with no entrance animation.
 */
export function ScreenshotGallery() {
  const { reduced } = useMotion();
  const [open, setOpen] = React.useState<BlogScreenshot | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {SCREENSHOTS.map((shot) => (
          <StaggerItem key={shot.src}>
            <button
              type="button"
              onClick={() => setOpen(shot)}
              className="t-glass-card t-lift t-focus-ring block w-full overflow-hidden border-sand/25 p-0 text-left"
              aria-label={`View screenshot: ${shot.caption}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.src}
                alt={shot.alt}
                loading="lazy"
                className="aspect-[1600/999] w-full object-cover"
              />
              <p className="px-4 py-3 font-[family-name:var(--font-dm)] text-sm text-smoke">
                {shot.caption}
              </p>
            </button>
          </StaggerItem>
        ))}
      </Stagger>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.caption}
          onClick={() => setOpen(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-bark/85 p-4 backdrop-blur-sm sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn("relative max-w-5xl", !reduced && "animate-fade-up")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={open.src}
              alt={open.alt}
              className="max-h-[82vh] w-auto rounded-2xl border border-sand/30"
            />
            <p className="mt-3 text-center font-[family-name:var(--font-dm)] text-sm text-linen">
              {open.caption}
            </p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Close screenshot"
              className="t-focus-ring absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-linen text-bark shadow-lg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
