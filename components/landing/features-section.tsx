import {
  Award,
  BarChart3,
  ShieldCheck,
  Users,
  Leaf,
  Zap,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";

export default async function FeaturesSection() {
  const t = await getTranslations("features");

  // Visual config stays here; copy comes from translations and is mapped onto it.
  const features = [
    {
      title: t("f1Title"),
      description: t("f1Desc"),
      icon: <Award className="h-6 w-6" />,
      color: "text-terra",
      bgColor: "bg-terra/10",
      glowClass: "glow-terra",
    },
    {
      title: t("f2Title"),
      description: t("f2Desc"),
      icon: <BarChart3 className="h-6 w-6" />,
      color: "text-clay",
      bgColor: "bg-clay/10",
      glowClass: "",
    },
    {
      title: t("f3Title"),
      description: t("f3Desc"),
      icon: <Leaf className="h-6 w-6" />,
      color: "text-sage-deep",
      bgColor: "bg-sage/10",
      glowClass: "glow-sage",
    },
    {
      title: t("f4Title"),
      description: t("f4Desc"),
      icon: <ShieldCheck className="h-6 w-6" />,
      color: "text-bark",
      bgColor: "bg-sand/20",
      glowClass: "",
    },
    {
      title: t("f5Title"),
      description: t("f5Desc"),
      icon: <Users className="h-6 w-6" />,
      color: "text-sage-deep",
      bgColor: "bg-sage/10",
      glowClass: "",
    },
    {
      title: t("f6Title"),
      description: t("f6Desc"),
      icon: <Zap className="h-6 w-6" />,
      color: "text-terra",
      bgColor: "bg-terra/10",
      glowClass: "glow-terra",
    },
  ];

  return (
    <section className="py-20 relative z-10">
      <div className="mx-auto max-w-7xl px-6">
        <Reveal className="text-center mb-12">
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold sm:text-4xl text-bark">
            {t("titlePrefix")}{" "}
            <span className="text-gradient-green font-semibold">{t("titleHighlight")}</span>
          </h2>
          <p className="mt-2 text-sm text-smoke max-w-xl mx-auto font-[family-name:var(--font-dm)]">
            {t("subtitle")}
          </p>
        </Reveal>

        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <StaggerItem
              key={feature.title}
              className="group t-glass-card p-6 border-sand/25 hover:shadow-[var(--t-shadow-md)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${feature.bgColor} ${feature.color} ${feature.glowClass}`}
                >
                  {feature.icon}
                </div>
                <h3 className="font-[family-name:var(--font-syne)] text-base font-bold text-bark mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-smoke font-[family-name:var(--font-dm)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
