import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden min-h-[90vh] flex items-center justify-center z-10">
      <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-terra/20 bg-terra/5 px-4 py-1.5 t-label text-terra animate-fade-up">
            <Sparkles className="h-3.5 w-3.5" />
            Climate-Tech for Every Household
          </div>

          {/* Heading */}
          <h1 className="font-[family-name:var(--font-cormorant)] text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl text-bark animate-fade-up-delay-1">
            Turning{" "}
            <span className="text-gradient-green font-semibold">Waste</span>{" "}
            into{" "}
            <span className="text-gradient-terra font-semibold">Worth</span>
          </h1>

          {/* Subtext */}
          <p className="mx-auto mt-6 max-w-2xl text-base text-smoke leading-relaxed sm:text-lg font-[family-name:var(--font-dm)] animate-fade-up-delay-2">
            Trashium connects households with recycling hubs. Schedule waste
            pickups, earn digital Green Credits, and track your real
            environmental impact — all from one platform.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-fade-up-delay-3">
            <Link href="/signup">
              <button
                className="btn-terra text-xs px-8 py-3.5 gap-2 border-0 cursor-pointer"
              >
                Join the Movement
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link href="#how-it-works">
              <button
                className="btn-ghost-terra text-xs px-8 py-3.5 border-terra/40 text-terra cursor-pointer"
              >
                Learn How It Works
              </button>
            </Link>
          </div>

          {/* Trust bar */}
          <div className="mt-16 flex items-center justify-center gap-8 text-smoke font-[family-name:var(--font-dm)] animate-fade-up-delay-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
              <div className="h-2 w-2 rounded-full bg-sage animate-pulse" />
              Eco-Verified
            </div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
              <div className="h-2 w-2 rounded-full bg-terra animate-pulse" />
              Reward-Backed
            </div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
              <div className="h-2 w-2 rounded-full bg-clay animate-pulse" />
              Community-Driven
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
