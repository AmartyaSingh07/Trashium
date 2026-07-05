"use client";

import * as React from "react";
import Link from "next/link";
import gsap from "gsap";
import { KineticHeading, Reveal, Stagger, StaggerItem } from "@/components/motion";
import {
  ensureRegistered,
  useIsomorphicLayoutEffect,
  useMotion,
} from "@/components/motion/gsap-provider";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { PhoneWidget } from "@/components/blog/phone-widget";
import { ScreenshotGallery } from "@/components/blog/screenshot-gallery";
import {
  BLOG_HERO,
  CTA,
  FEATURE_BEATS,
  GALLERY_SECTION,
  PHONE_SECTION,
  STATS,
  STATS_SECTION,
} from "@/lib/blog-content";
import { cn } from "@/lib/utils";

export default function BlogContent() {
  const { reduced } = useMotion();
  const heroRef = React.useRef<HTMLElement>(null);
  const parallaxRef = React.useRef<HTMLDivElement>(null);
  const statsRef = React.useRef<HTMLDivElement>(null);
  const [statsLive, setStatsLive] = React.useState(false);

  // Ribbon flourish for this page only: the ribbons layer is a sibling of page
  // content in the root layout, so the override must live on a shared ancestor
  // (body) — a wrapper div here couldn't reach it. Reverted on unmount.
  React.useEffect(() => {
    document.body.style.setProperty("--ribbon-opacity", "0.32");
    return () => {
      document.body.style.removeProperty("--ribbon-opacity");
    };
  }, []);

  // Hero parallax: the decorative terra wash drifts down as the hero scrolls
  // out. Scrubbed, so progress maps 1:1 to scroll (ease "none" — an eased curve
  // would fight the scrub). Reduced motion → element stays static.
  useIsomorphicLayoutEffect(() => {
    const section = heroRef.current;
    const el = parallaxRef.current;
    if (reduced || !section || !el) return;
    ensureRegistered();

    const ctx = gsap.context(() => {
      gsap.to(el, {
        y: 140,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    }, section);
    return () => ctx.revert();
  }, [reduced]);

  // Stats count up from 0 when the band enters the viewport. Under reduced
  // motion render the final values immediately (NumberFlow is also
  // reduced-motion-safe internally).
  React.useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsLive(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden border-b border-sand/20 bg-linen/40"
      >
        <div
          ref={parallaxRef}
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(194,112,61,0.18) 0%, rgba(194,112,61,0) 70%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl px-6 py-24 text-center lg:py-32">
          <p className="t-label mb-4 text-terra">{BLOG_HERO.eyebrow}</p>
          <KineticHeading
            as="h1"
            text={BLOG_HERO.title}
            className="font-[family-name:var(--font-cormorant)] text-4xl font-semibold leading-[1.05] text-bark sm:text-5xl lg:text-6xl"
          />
          <p className="mx-auto mt-6 max-w-2xl font-[family-name:var(--font-dm)] text-base leading-relaxed text-smoke">
            {BLOG_HERO.subtitle}
          </p>
        </div>
      </section>

      {/* ── Phone centerpiece + feature beats ───────────────────────────── */}
      <section className="border-b border-sand/20 bg-linen/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="mb-14 text-center">
            <p className="t-label mb-3 text-terra">{PHONE_SECTION.eyebrow}</p>
            <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
              {PHONE_SECTION.title}
            </h2>
          </Reveal>

          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Sticky is the "pin" (spec prefers it over ScrollTrigger pin);
                dropped under reduced motion so nothing tracks the scroll. */}
            <div className={cn("lg:self-start", !reduced && "lg:sticky lg:top-28")}>
              <PhoneWidget />
            </div>

            <div className="flex flex-col justify-center gap-6 lg:py-8">
              {FEATURE_BEATS.map((beat, i) => (
                <Reveal key={beat.title} className="t-glass-card border-sand/25 p-7">
                  <span className="font-[family-name:var(--font-jetbrains)] text-sm font-medium text-terra/60">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 font-[family-name:var(--font-syne)] text-base font-bold text-bark">
                    {beat.title}
                  </h3>
                  <p className="mt-2 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
                    {beat.body}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Screenshot gallery ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Reveal className="mb-12 text-center">
          <p className="t-label mb-3 text-terra">{GALLERY_SECTION.eyebrow}</p>
          <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
            {GALLERY_SECTION.title}
          </h2>
        </Reveal>
        <ScreenshotGallery />
      </section>

      {/* ── Impact stats ─────────────────────────────────────────────────── */}
      <section className="border-y border-sand/20 bg-linen/50 py-20">
        <div ref={statsRef} className="mx-auto max-w-5xl px-6">
          <Reveal className="mb-12 text-center">
            <p className="t-label mb-3 text-terra">{STATS_SECTION.eyebrow}</p>
            <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
              {STATS_SECTION.title}
            </h2>
          </Reveal>
          <Stagger className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {STATS.map((stat) => (
              <StaggerItem
                key={stat.label}
                className="rounded-2xl border border-sand/25 bg-parchment/50 p-6 text-center"
              >
                <AnimatedNumber
                  value={reduced || statsLive ? stat.value : 0}
                  className="t-stat leading-normal text-terra"
                />
                <p className="mt-2 font-[family-name:var(--font-dm)] text-sm text-smoke">
                  {stat.label}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Closing CTA band ─────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <Reveal className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-terra via-terra-deep to-moss px-8 py-14 text-center">
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-linen sm:text-4xl">
            {CTA.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-dm)] text-sm leading-relaxed text-linen/80">
            {CTA.body}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={CTA.primary.href}
              className="t-focus-ring inline-flex items-center justify-center rounded-full bg-linen px-7 py-3 font-[family-name:var(--font-syne)] text-sm font-semibold tracking-wide text-bark transition-transform duration-300 hover:-translate-y-0.5"
            >
              {CTA.primary.label}
            </Link>
            <Link
              href={CTA.secondary.href}
              className="t-focus-ring inline-flex items-center justify-center rounded-full border border-linen/50 px-7 py-3 font-[family-name:var(--font-syne)] text-sm font-semibold tracking-wide text-linen transition-colors duration-300 hover:bg-linen/10"
            >
              {CTA.secondary.label}
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
