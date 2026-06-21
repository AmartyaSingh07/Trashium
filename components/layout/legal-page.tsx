import Link from "next/link";
import { getTranslations } from "next-intl/server";
import PageShell from "@/components/layout/page-shell";

export type LegalSection = {
  id: string;
  heading: string;
  /** Section body. Use the shared prose helpers below for consistent styling. */
  body: React.ReactNode;
};

/**
 * Shared layout for Privacy Policy, Terms of Service, and Cookie Policy.
 * Two-column on desktop: a sticky section index on the left, prose on the right.
 * Single column on mobile. Keeps all three legal pages visually consistent.
 */
export default async function LegalPage({
  title,
  intro,
  updated,
  sections,
}: {
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  const t = await getTranslations("legalCommon");
  return (
    <PageShell>
      <section className="border-b border-sand/20 bg-linen/40">
        <div className="mx-auto max-w-4xl px-6 py-16 lg:py-20">
          <p className="t-label mb-3 text-terra">{t("eyebrow")}</p>
          <h1 className="font-[family-name:var(--font-cormorant)] text-4xl font-semibold text-bark sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl font-[family-name:var(--font-dm)] text-base leading-relaxed text-smoke">
            {intro}
          </p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-sand/40 bg-parchment/60 px-3 py-1 font-[family-name:var(--font-jetbrains)] text-xs text-smoke">
            {t("lastUpdated")} · {updated}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-14 lg:grid-cols-[14rem_1fr] lg:py-20">
        {/* Sticky section index (desktop) */}
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-1">
            <p className="t-label mb-3 text-smoke">{t("onThisPage")}</p>
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-lg px-3 py-1.5 font-[family-name:var(--font-dm)] text-sm text-smoke transition-colors hover:bg-terra/8 hover:text-terra"
              >
                {s.heading}
              </a>
            ))}
          </nav>
        </aside>

        {/* Prose */}
        <article className="max-w-2xl">
          {sections.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              className="scroll-mt-28 border-sand/20 py-8 first:pt-0 [&:not(:last-child)]:border-b"
            >
              <h2 className="mb-4 flex items-baseline gap-3 font-[family-name:var(--font-syne)] text-xl font-bold text-bark">
                <span className="font-[family-name:var(--font-jetbrains)] text-sm font-medium text-terra/70">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              <div className="space-y-4">{s.body}</div>
            </section>
          ))}

          <div className="mt-10 rounded-2xl border border-sand/30 bg-parchment/50 p-6">
            <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-bark">
              {t("questionsTitle")}
            </h3>
            <p className="mt-2 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
              {t("questionsBodyPrefix")}{" "}
              <a
                href="mailto:team.trashium@gmail.com"
                className="font-medium text-terra underline-offset-4 hover:underline"
              >
                team.trashium@gmail.com
              </a>{" "}
              {t("questionsBodyMiddle")}{" "}
              <Link
                href="/about"
                className="font-medium text-terra underline-offset-4 hover:underline"
              >
                {t("aboutPageLink")}
              </Link>
              .
            </p>
          </div>
        </article>
      </div>
    </PageShell>
  );
}

/* ── Shared prose helpers — keep legal copy styling consistent ─────────── */

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
      {children}
    </p>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="space-y-2 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-smoke">
      {children}
    </ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terra/60" />
      <span>{children}</span>
    </li>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-sage/30 bg-sage/8 p-4 font-[family-name:var(--font-dm)] text-sm leading-relaxed text-sage-deep">
      {children}
    </div>
  );
}
