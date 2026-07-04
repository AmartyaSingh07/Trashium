"use client";

import { useEffect, useRef, useState } from "react";
import { Recycle, Wind, Users, Award } from "lucide-react";
import { useTranslations } from "next-intl";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { useMotion } from "@/components/motion/gsap-provider";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface StatItem {
  label: string;
  value: number;
  suffix: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface ImpactCounterProps {
  stats?: {
    total_kg_recycled: number;
    total_co2_saved: number;
    total_households: number;
    total_green_credits: number;
  };
}

export default function ImpactCounter({ stats }: ImpactCounterProps) {
  const t = useTranslations("impact");
  const { reduced } = useMotion();

  // NumberFlow renders its value immediately and animates on change — it does not
  // count up from 0 on mount. So hold the cards at 0 until the section scrolls into
  // view, then set the targets once (reproduces the old IntersectionObserver count-up).
  // Reduced motion: reveal immediately so a number never sits stuck at 0.
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced-motion: reveal immediately so numbers never sit stuck at 0
      setInView(true);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  const data: StatItem[] = [
    {
      label: t("kgCollected"),
      value: stats?.total_kg_recycled ?? 12450,
      suffix: "+",
      icon: <Recycle className="h-6 w-6" />,
      color: "text-sage-deep",
      bgColor: "bg-sage/15",
    },
    {
      label: t("co2Saved"),
      value: stats?.total_co2_saved ?? 8930,
      suffix: "+",
      icon: <Wind className="h-6 w-6" />,
      color: "text-clay",
      bgColor: "bg-clay/15",
    },
    {
      label: t("householdsJoined"),
      value: stats?.total_households ?? 342,
      suffix: "+",
      icon: <Users className="h-6 w-6" />,
      color: "text-bark",
      bgColor: "bg-sand/25",
    },
    {
      label: t("creditsEarned"),
      value: stats?.total_green_credits ?? 28750,
      suffix: "+",
      icon: <Award className="h-6 w-6" />,
      color: "text-terra",
      bgColor: "bg-terra/15",
    },
  ];

  return (
    <section ref={sectionRef} className="py-20 bg-parchment/90 border-y border-sand/35 relative z-10">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="text-center mb-12">
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold sm:text-4xl text-bark">
            {t("titlePrefix")} <span className="text-gradient-terra font-semibold">{t("titleHighlight")}</span>
          </h2>
          <p className="mt-2 text-sm text-smoke font-[family-name:var(--font-dm)]">
            {t("subtitle")}
          </p>
        </Reveal>

        <Stagger className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {data.map((stat) => (
            <StaggerItem
              key={stat.label}
              className="group relative overflow-hidden t-glass-card bg-linen/30 hover:bg-linen/60 border-sand/30 hover:shadow-[var(--t-shadow-md)] p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1"
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${stat.bgColor} ${stat.color}`}
              >
                {stat.icon}
              </div>
              <div className={`text-3xl font-extrabold tracking-tight sm:text-4xl font-[family-name:var(--font-jetbrains)] ${stat.color}`}>
                <AnimatedNumber value={inView ? stat.value : 0} suffix={stat.suffix} className="tabular-nums" />
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-smoke font-[family-name:var(--font-dm)]">
                {stat.label}
              </p>

              {/* Subtle accent border on hover */}
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-terra/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
