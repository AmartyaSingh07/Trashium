import type { Metadata } from "next";
import Link from "next/link";
import {
  Code2,
  Server,
  Smartphone,
  BrainCircuit,
  Route,
  Users,
  Leaf,
  Mail,
  Sparkles,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import PageShell from "@/components/layout/page-shell";
import PageHero from "@/components/layout/page-hero";

export const metadata: Metadata = {
  title: "Careers — Trashium",
  description:
    "Help build the future of smart waste management. Collaboration, internship and contributor opportunities across engineering, AI/ML, logistics and field operations.",
};

export default async function CareersPage() {
  const t = await getTranslations("careers");

  const reasons = [
    { title: t("reason1Title"), body: t("reason1Body") },
    { title: t("reason2Title"), body: t("reason2Body") },
    { title: t("reason3Title"), body: t("reason3Body") },
  ];

  const roles = [
    { icon: <Code2 className="h-6 w-6" />, area: t("roleFrontend"), body: t("roleFrontendBody") },
    { icon: <Server className="h-6 w-6" />, area: t("roleBackend"), body: t("roleBackendBody") },
    { icon: <Smartphone className="h-6 w-6" />, area: t("roleMobile"), body: t("roleMobileBody") },
    { icon: <BrainCircuit className="h-6 w-6" />, area: t("roleAi"), body: t("roleAiBody") },
    { icon: <Route className="h-6 w-6" />, area: t("roleLogistics"), body: t("roleLogisticsBody") },
    { icon: <Users className="h-6 w-6" />, area: t("roleFieldOps"), body: t("roleFieldOpsBody") },
    { icon: <Leaf className="h-6 w-6" />, area: t("roleSustainability"), body: t("roleSustainabilityBody") },
    { icon: <Users className="h-6 w-6" />, area: t("roleOutreach"), body: t("roleOutreachBody") },
  ];

  return (
    <PageShell>
      <PageHero
        eyebrow={t("heroEyebrow")}
        title={t("heroTitle")}
        highlight={t("heroHighlight")}
        subtitle={t("heroSubtitle")}
      />

      {/* Stage note */}
      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-2xl border border-amber-warm/30 bg-amber-warm/8 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-clay" />
            <div>
              <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark">
                {t("stageTitle")}
              </h2>
              <p className="mt-2 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
                {t("stageBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why work with us */}
      <section className="border-y border-sand/20 bg-linen/50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-10">
            <p className="t-label mb-3 text-terra">{t("whyEyebrow")}</p>
            <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
              {t("whyTitle")}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {reasons.map((r) => (
              <div
                key={r.title}
                className="t-glass-card border-sand/25 p-7"
              >
                <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-bark">
                  {r.title}
                </h3>
                <p className="mt-2 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Areas */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10">
          <p className="t-label mb-3 text-terra">{t("areasEyebrow")}</p>
          <h2 className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark sm:text-3xl">
            {t("areasTitle")}
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((r) => (
            <div
              key={r.area}
              className="group rounded-2xl border border-sand/25 bg-parchment/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-terra/30"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-terra/10 text-terra transition-transform duration-300 group-hover:scale-105">
                {r.icon}
              </div>
              <h3 className="font-[family-name:var(--font-syne)] text-sm font-bold text-bark">
                {r.area}
              </h3>
              <p className="mt-2 font-[family-name:var(--font-dm)] text-xs leading-relaxed text-smoke">
                {r.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact / apply */}
      <section className="border-t border-sand/20 bg-linen/60 py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-terra/10 text-terra">
            <Mail className="h-7 w-7" />
          </div>
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold text-bark sm:text-4xl">
            {t("contactTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
            {t("contactBody")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="mailto:team.trashium@gmail.com?subject=Collaborating%20with%20Trashium"
              className="btn-terra"
            >
              {t("contactPrimary")}
            </a>
            <Link href="/about" className="btn-ghost-terra">
              {t("contactSecondary")}
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
