"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "@/components/motion";

export default function Footer() {
  const t = useTranslations("footer");

  // Built from translations: group titles + link labels are localized, hrefs stay
  // as English route slugs (per plan §8 — do not translate route paths).
  const footerLinks: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: t("platform"),
      links: [{ label: t("howItWorks"), href: "/#how-it-works" }],
    },
    {
      title: t("company"),
      links: [
        { label: t("about"), href: "/about" },
        { label: t("careers"), href: "/careers" },
        { label: t("blog"), href: "/blog" },
      ],
    },
    {
      title: t("legal"),
      links: [
        { label: t("privacyPolicy"), href: "/privacy-policy" },
        { label: t("termsOfService"), href: "/terms-of-service" },
        { label: t("cookiePolicy"), href: "/cookie-policy" },
      ],
    },
  ];

  const howItWorksLabel = t("howItWorks");

  return (
    <footer className="border-t border-terra/10 bg-linen/90 backdrop-blur-md relative z-10">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <Reveal className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="t-focus-ring flex items-center gap-2 mb-4 group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-terra/10 transition-transform group-hover:scale-105">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/trashium-icon-static.svg" alt="" className="h-5 w-5" />
              </div>
              <span className="font-[family-name:var(--font-cormorant)] text-2xl font-semibold text-bark">
                Trashium
              </span>
            </Link>
            <p className="text-sm text-smoke leading-relaxed font-[family-name:var(--font-dm)]">
              {t("tagline")}
            </p>
          </div>

          {/* Link Groups */}
          {footerLinks.map((group) => (
            <div key={group.title} className="flex flex-col gap-3">
              <h3 className="t-label text-bark font-bold tracking-wider">
                {group.title}
              </h3>
              <ul className="space-y-2">
                {group.links.map((link) => {
                  const isHowItWorks = link.label === howItWorksLabel;
                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className={
                          isHowItWorks
                            ? "t-focus-ring text-smoke hover:text-terra transition-colors duration-150 text-sm text-left block py-1 font-[family-name:var(--font-dm)]"
                            : "t-focus-ring text-sm text-smoke transition-colors hover:text-terra font-[family-name:var(--font-dm)]"
                        }
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Reveal>

        <Separator className="my-8 bg-sand/35" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-smoke font-[family-name:var(--font-dm)]">
            © {new Date().getFullYear()} {t("copyright")}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-smoke font-[family-name:var(--font-dm)]">
            <span>{t("craftedWith")}</span>
            <span className="text-terra animate-pulse">✦</span>
            <span>{t("sharedEnvironment")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
