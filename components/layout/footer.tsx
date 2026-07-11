"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CometCard } from "@/components/ui/comet-card";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "@/components/motion";
import AmartyaSinghPhoto from "@/Team/Amartya Singh.png";
import AmitaGhoshPhoto from "@/Team/Amita Ghosh.png";
import FardeenAnsariPhoto from "@/Team/Fardeen Ansari.png";
import ShubhashreeBharPhoto from "@/Team/Shubhashree Bhar.png";
import SnehaDebPhoto from "@/Team/Sneha Deb.png";

const teamMembers = [
  { name: "Amartya Singh", role: "Full Stack Developer", photo: AmartyaSinghPhoto },
  { name: "Shubhashree Bhar", role: "AI/ML Engineer", photo: ShubhashreeBharPhoto },
  { name: "Fardeen Ansari", role: "AI/ML Engineer", photo: FardeenAnsariPhoto },
  { name: "Sneha Deb", role: "QA & Testing Engineer", photo: SnehaDebPhoto },
  { name: "Amita Ghosh", role: "QA & Testing Engineer", photo: AmitaGhoshPhoto },
];

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
            <div className="mt-5 flex items-center" aria-label="Trashium team members">
              {teamMembers.map((member, index) => {
                const previewAlignment =
                  index === 0
                    ? "left-0"
                    : index === teamMembers.length - 1
                      ? "right-0"
                      : "left-1/2 -translate-x-1/2";

                return (
                  <div key={member.name} className="group relative -ml-3 first:ml-0">
                    <button
                      type="button"
                      className="t-focus-ring relative h-11 w-11 overflow-hidden rounded-full border-2 border-linen bg-parchment shadow-sm ring-1 ring-terra/15 transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                      style={{ zIndex: teamMembers.length - index }}
                      aria-label={`${member.name}, ${member.role}`}
                    >
                      <Image
                        src={member.photo}
                        alt=""
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </button>
                    <div
                      className={`pointer-events-none absolute bottom-12 ${previewAlignment} z-50 w-56 opacity-0 translate-y-2 scale-95 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-y-0 group-focus-within:scale-100 motion-reduce:transform-none motion-reduce:transition-none`}
                    >
                      <CometCard rotateDepth={9} translateDepth={8}>
                        <div className="rounded-2xl border border-terra/15 bg-bark p-2 text-linen shadow-[0_18px_48px_rgba(42,34,24,0.28)]">
                          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-clay">
                            <Image
                              src={member.photo}
                              alt={member.name}
                              fill
                              sizes="224px"
                              className="object-cover"
                            />
                          </div>
                          <div className="px-2 py-3">
                            <div className="font-[family-name:var(--font-syne)] text-sm font-semibold leading-tight">
                              {member.name}
                            </div>
                            <div className="mt-1 text-xs leading-tight text-linen/70">
                              {member.role}
                            </div>
                          </div>
                        </div>
                      </CometCard>
                    </div>
                  </div>
                );
              })}
            </div>
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
