import { CalendarCheck, Truck, Award } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export default async function HowItWorks() {
  const t = await getTranslations("howItWorks");

  // Visual config stays here; copy comes from translations and is mapped onto it.
  const steps = [
    {
      step: "01",
      title: t("step1Title"),
      description: t("step1Desc"),
      icon: <CalendarCheck className="h-7 w-7" />,
      color: "text-sage-deep",
      bgColor: "bg-sage/10",
      borderColor: "border-sand/20",
    },
    {
      step: "02",
      title: t("step2Title"),
      description: t("step2Desc"),
      icon: <Truck className="h-7 w-7" />,
      color: "text-terra",
      bgColor: "bg-terra/10",
      borderColor: "border-sand/20",
    },
    {
      step: "03",
      title: t("step3Title"),
      description: t("step3Desc"),
      icon: <Award className="h-7 w-7" />,
      color: "text-clay",
      bgColor: "bg-clay/10",
      borderColor: "border-sand/20",
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-linen/50 border-b border-sand/20 relative z-10">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="text-center mb-12">
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold sm:text-4xl text-bark">
            {t("titleHow")} <span className="text-gradient-terra font-semibold">Trashium</span> {t("titleWorks")}
          </h2>
          <p className="mt-2 text-sm text-smoke max-w-xl mx-auto font-[family-name:var(--font-dm)]">
            {t("subtitle")}
          </p>
        </Reveal>

        <Stagger className="grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <StaggerItem
              key={step.step}
              className="group relative overflow-hidden t-glass-card p-8 border-sand/25 hover:shadow-[var(--t-shadow-lg)] transition-all duration-300 hover:-translate-y-1"
            >
              {/* Step number watermark */}
              <span className="text-6xl font-[family-name:var(--font-syne)] font-black text-sand/20 absolute top-4 right-4 select-none">
                {step.step}
              </span>

              <div
                className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${step.bgColor} ${step.color} transition-transform duration-300 group-hover:scale-105`}
              >
                {step.icon}
              </div>

              <h3 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark mb-2">{step.title}</h3>
              <p className="text-sm text-smoke font-[family-name:var(--font-dm)] leading-relaxed">
                {step.description}
              </p>

              {/* Connector line (visible on desktop) */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-px bg-sand/30 z-10" />
              )}
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
