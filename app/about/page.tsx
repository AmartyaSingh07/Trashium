import type { Metadata } from "next";
import Link from "next/link";
import {
  Recycle,
  MapPin,
  Sprout,
  Truck,
  Coins,
  GraduationCap,
  HeartHandshake,
  Repeat,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import PageShell from "@/components/layout/page-shell";
import PageHero from "@/components/layout/page-hero";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export const metadata: Metadata = {
  title: "About Us — Trashium",
  description:
    "Trashium is an AI-assisted recyclables platform born from a West Bengal field survey across Rishra, Belur, Bally and Shyamnagar. Learn what we built and why.",
};

export default async function AboutPage() {
  const t = await getTranslations("about");

  const problems = [t("problem1"), t("problem2"), t("problem3"), t("problem4")];

  const steps = [
    { icon: <Truck className="h-6 w-6" />, title: t("step1Title"), body: t("step1Body") },
    { icon: <Coins className="h-6 w-6" />, title: t("step2Title"), body: t("step2Body") },
    { icon: <Sprout className="h-6 w-6" />, title: t("step3Title"), body: t("step3Body") },
  ];

  const impact = [
    { icon: <Repeat className="h-6 w-6" />, title: t("impact1Title"), body: t("impact1Body") },
    { icon: <HeartHandshake className="h-6 w-6" />, title: t("impact2Title"), body: t("impact2Body") },
    { icon: <MapPin className="h-6 w-6" />, title: t("impact3Title"), body: t("impact3Body") },
  ];

  return (
    <PageShell>
      <PageHero
        eyebrow={t("heroEyebrow")}
        title={t("heroTitle")}
        highlight={t("heroHighlight")}
        subtitle={t("heroSubtitle")}
      />

      {/* What it is */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <Reveal className="t-glass-card border-sand/25 p-8 sm:p-10">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-terra/10 text-terra">
            <Recycle className="h-6 w-6" />
          </div>
          <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
            {t("whatTitle")}
          </h2>
          <p className="mt-4 font-[family-name:var(--font-dm)] text-base leading-relaxed text-smoke">
            {t("whatBody")}
          </p>
        </Reveal>
      </section>

      {/* The problem */}
      <section className="border-y border-sand/20 bg-linen/50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal>
            <p className="t-label mb-3 text-terra">{t("problemEyebrow")}</p>
            <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
              {t("problemTitle")}
            </h2>
          </Reveal>
          <Stagger className="mt-8 grid gap-4 sm:grid-cols-2">
            {problems.map((p, i) => (
              <StaggerItem
                key={i}
                className="flex gap-4 rounded-2xl border border-sand/25 bg-parchment/50 p-5"
              >
                <span className="font-[family-name:var(--font-jetbrains)] text-lg font-medium text-terra/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
                  {p}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Mission & vision */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <Stagger className="grid gap-6 md:grid-cols-2">
          <StaggerItem className="rounded-2xl border border-terra/20 bg-terra/5 p-8">
            <h3 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark">
              {t("missionTitle")}
            </h3>
            <p className="mt-3 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
              {t("missionBody")}
            </p>
          </StaggerItem>
          <StaggerItem className="rounded-2xl border border-sage/25 bg-sage/8 p-8">
            <h3 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark">
              {t("visionTitle")}
            </h3>
            <p className="mt-3 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
              {t("visionBody")}
            </p>
          </StaggerItem>
        </Stagger>
      </section>

      {/* How it works */}
      <section className="border-y border-sand/20 bg-linen/50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal className="mb-10 text-center">
            <p className="t-label mb-3 text-terra">{t("howEyebrow")}</p>
            <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
              {t("howTitle")}
            </h2>
          </Reveal>
          <Stagger className="grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <StaggerItem
                key={s.title}
                className="t-glass-card border-sand/25 p-7 transition-transform duration-300 hover:-translate-y-1"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-terra/10 text-terra">
                  {s.icon}
                </div>
                <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-bark">
                  {s.title}
                </h3>
                <p className="mt-2 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
                  {s.body}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Circular economy + impact */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <Reveal className="mb-10">
          <p className="t-label mb-3 text-terra">{t("circularEyebrow")}</p>
          <h2 className="max-w-2xl font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
            {t("circularTitle")}
          </h2>
          <p className="mt-4 max-w-2xl font-[family-name:var(--font-dm)] text-base leading-relaxed text-smoke">
            {t("circularBody")}
          </p>
        </Reveal>
        <Stagger className="grid gap-6 md:grid-cols-3">
          {impact.map((s) => (
            <StaggerItem
              key={s.title}
              className="rounded-2xl border border-sand/25 bg-parchment/50 p-7"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sage/12 text-sage-deep">
                {s.icon}
              </div>
              <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-bark">
                {s.title}
              </h3>
              <p className="mt-2 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
                {s.body}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Field survey */}
      <section className="border-y border-sand/20 bg-linen/50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <Reveal className="flex flex-col gap-8 md:flex-row md:items-start">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-terra/10 text-terra">
              <MapPin className="h-7 w-7" />
            </div>
            <div>
              <p className="t-label mb-3 text-terra">{t("surveyEyebrow")}</p>
              <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
                {t("surveyTitle")}
              </h2>
              <p className="mt-4 font-[family-name:var(--font-dm)] text-base leading-relaxed text-smoke">
                {t("surveyBody1")}
              </p>
              <p className="mt-4 font-[family-name:var(--font-dm)] text-base leading-relaxed text-smoke">
                {t("surveyBody2")}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Academic background */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <Reveal className="rounded-2xl border border-sand/30 bg-parchment/50 p-8 sm:p-10">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-clay/10 text-clay">
            <GraduationCap className="h-6 w-6" />
          </div>
          <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
            {t("academicTitle")}
          </h2>
          <p className="mt-4 font-[family-name:var(--font-dm)] text-base leading-relaxed text-smoke">
            {t("academicBody")}
          </p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="border-t border-sand/20 bg-linen/60 py-16">
        <Reveal className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-bark sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
            {t("ctaSubtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/dashboard" className="btn-terra">
              {t("ctaPrimary")}
            </Link>
            <Link href="/#rates" className="btn-ghost-terra">
              {t("ctaSecondary")}
            </Link>
          </div>
        </Reveal>
      </section>
    </PageShell>
  );
}
