"use client";

import AnimatedCounter from "@/components/ui/animated-counter";
import { Recycle, Wind, Users, Award } from "lucide-react";

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
  const data: StatItem[] = [
    {
      label: "Kg Plastic Saved",
      value: stats?.total_kg_recycled ?? 12450,
      suffix: "+",
      icon: <Recycle className="h-6 w-6" />,
      color: "text-sage-deep",
      bgColor: "bg-sage/15",
    },
    {
      label: "CO₂ Offset (kg)",
      value: stats?.total_co2_saved ?? 8930,
      suffix: "+",
      icon: <Wind className="h-6 w-6" />,
      color: "text-clay",
      bgColor: "bg-clay/15",
    },
    {
      label: "Households Joined",
      value: stats?.total_households ?? 342,
      suffix: "+",
      icon: <Users className="h-6 w-6" />,
      color: "text-bark",
      bgColor: "bg-sand/25",
    },
    {
      label: "Green Credits Earned",
      value: stats?.total_green_credits ?? 28750,
      suffix: "+",
      icon: <Award className="h-6 w-6" />,
      color: "text-terra",
      bgColor: "bg-terra/15",
    },
  ];

  return (
    <section className="py-20 bg-parchment/90 border-y border-sand/35 relative z-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold sm:text-4xl text-bark">
            Our Global <span className="text-gradient-terra font-semibold">Impact</span>
          </h2>
          <p className="mt-2 text-sm text-smoke font-[family-name:var(--font-dm)]">
            Real-time metrics from our growing community of conscious recyclers
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {data.map((stat, i) => (
            <div
              key={stat.label}
              className="group relative overflow-hidden t-glass-card bg-linen/30 hover:bg-linen/60 border-sand/30 hover:shadow-[var(--t-shadow-md)] p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div
                className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${stat.bgColor} ${stat.color}`}
              >
                {stat.icon}
              </div>
              <div className={`text-3xl font-extrabold tracking-tight sm:text-4xl font-[family-name:var(--font-jetbrains)] ${stat.color}`}>
                <AnimatedCounter end={stat.value} suffix={stat.suffix} />
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-smoke font-[family-name:var(--font-dm)]">
                {stat.label}
              </p>

              {/* Subtle accent border on hover */}
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-terra/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
