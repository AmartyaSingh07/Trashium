import { CalendarCheck, Truck, Award } from "lucide-react";

const steps = [
  {
    step: "01",
    title: "Schedule a Pickup",
    description:
      "Choose your waste type, set a date, and request a doorstep pickup in seconds.",
    icon: <CalendarCheck className="h-7 w-7" />,
    color: "text-sage-deep",
    bgColor: "bg-sage/10",
    borderColor: "border-sand/20",
  },
  {
    step: "02",
    title: "We Collect & Recycle",
    description:
      "Our verified collectors pick up your waste and deliver it to certified recycling hubs.",
    icon: <Truck className="h-7 w-7" />,
    color: "text-terra",
    bgColor: "bg-terra/10",
    borderColor: "border-sand/20",
  },
  {
    step: "03",
    title: "Earn Green Credits",
    description:
      "Get rewarded with digital credits based on weight and type. Level up your eco-rank!",
    icon: <Award className="h-7 w-7" />,
    color: "text-clay",
    bgColor: "bg-clay/10",
    borderColor: "border-sand/20",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-linen/50 border-b border-sand/20 relative z-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center mb-12">
          <h2 className="font-[family-name:var(--font-cormorant)] text-3xl font-semibold sm:text-4xl text-bark">
            How <span className="text-gradient-terra font-semibold">Trashium</span> Works
          </h2>
          <p className="mt-2 text-sm text-smoke max-w-xl mx-auto font-[family-name:var(--font-dm)]">
            Three simple steps to make a real impact on the environment — and
            earn rewards while you&apos;re at it.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <div
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
