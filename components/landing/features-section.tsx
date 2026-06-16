import {
  Award,
  BarChart3,
  ShieldCheck,
  Users,
  Leaf,
  Zap,
} from "lucide-react";

const features = [
  {
    title: "Green Credits System",
    description:
      "Earn digital credits for every kg you recycle. Redeem them for rewards, discounts, or donate to environmental causes.",
    icon: <Award className="h-6 w-6" />,
    color: "text-terra",
    bgColor: "bg-terra/10",
    glowClass: "glow-terra",
  },
  {
    title: "Real-Time Impact Tracking",
    description:
      "Monitor your CO₂ savings, recycled materials, and community impact with beautiful, live dashboards.",
    icon: <BarChart3 className="h-6 w-6" />,
    color: "text-clay",
    bgColor: "bg-clay/10",
    glowClass: "",
  },
  {
    title: "Eco-Level Gamification",
    description:
      "Progress from Seedling to Earth Guardian. Unlock badges, climb leaderboards, and compete with your neighborhood.",
    icon: <Leaf className="h-6 w-6" />,
    color: "text-sage-deep",
    bgColor: "bg-sage/10",
    glowClass: "glow-sage",
  },
  {
    title: "Verified Collector Network",
    description:
      "Our collectors are vetted and tracked. Every pickup is logged, verified, and fully transparent.",
    icon: <ShieldCheck className="h-6 w-6" />,
    color: "text-bark",
    bgColor: "bg-sand/20",
    glowClass: "",
  },
  {
    title: "Community Rankings",
    description:
      "See how your household, neighborhood, or city stacks up. Collective action drives collective impact.",
    icon: <Users className="h-6 w-6" />,
    color: "text-sage-deep",
    bgColor: "bg-sage/10",
    glowClass: "",
  },
  {
    title: "Instant Scheduling",
    description:
      "Book a pickup in under 30 seconds. Choose waste type, set date and time, and you're done.",
    icon: <Zap className="h-6 w-6" />,
    color: "text-terra",
    bgColor: "bg-terra/10",
    glowClass: "glow-terra",
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 relative z-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold sm:text-4xl text-bark">
            Everything You Need to{" "}
            <span className="text-gradient-green font-semibold">Go Green</span>
          </h2>
          <p className="mt-2 text-sm text-smoke max-w-xl mx-auto font-[family-name:var(--font-dm)]">
            A full-featured platform designed to make sustainable living
            effortless and rewarding.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
