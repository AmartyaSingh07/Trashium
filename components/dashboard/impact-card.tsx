import { Card, CardContent } from "@/components/ui/card";
import { Recycle, Wind, Award } from "lucide-react";

interface ImpactCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: "credits" | "recycled" | "co2";
}

const iconMap = {
  credits: {
    icon: <Award className="h-6 w-6 animate-pulse" />,
    color: "text-terra",
    bgColor: "bg-terra/10",
    glowClass: "glow-terra",
    gradientFrom: "from-terra/15",
    gradientTo: "to-terra/2",
  },
  recycled: {
    icon: <Recycle className="h-6 w-6 animate-spin-slow" style={{ animationDuration: "12s" }} />,
    color: "text-sage-deep",
    bgColor: "bg-sage/10",
    glowClass: "glow-sage",
    gradientFrom: "from-sage/15",
    gradientTo: "to-sage/2",
  },
  co2: {
    icon: <Wind className="h-6 w-6" />,
    color: "text-clay",
    bgColor: "bg-clay/10",
    glowClass: "",
    gradientFrom: "from-clay/15",
    gradientTo: "to-clay/2",
  },
};

export default function ImpactCard({
  title,
  value,
  subtitle,
  icon,
}: ImpactCardProps) {
  const config = iconMap[icon];
  const isCredits = icon === "credits";

  return (
    <div className="group relative overflow-hidden t-glass-card hover:shadow-[var(--t-shadow-lg)] transition-all duration-300 hover:-translate-y-1">
      {/* Top gradient highlights */}
      <div
        className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${config.gradientFrom} via-transparent ${config.gradientTo}`}
      />

      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="t-label text-smoke">{title}</p>
            <p
              className={`text-3xl font-extrabold tracking-tight font-[family-name:var(--font-jetbrains)] ${
                isCredits ? "credits-number" : config.color
              }`}
            >
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-smoke/70 font-[family-name:var(--font-dm)]">{subtitle}</p>
          </div>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${config.bgColor} ${config.color} ${config.glowClass}`}
          >
            {config.icon}
          </div>
        </div>
      </div>
    </div>
  );
}
