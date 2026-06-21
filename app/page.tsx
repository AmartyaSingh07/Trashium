import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import HeroSection from "@/components/landing/hero-section";
import ImpactCounter from "@/components/landing/impact-counter";
import HowItWorks from "@/components/landing/how-it-works";
import FeaturesSection from "@/components/landing/features-section";
import FlippingRates from "@/components/materials/flipping-rates";
import { getTileRatesBySector } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: impact } = await supabase
    .from("global_impact")
    .select("*")
    .single();

  // Live per-sector rates for the flipping rate tiles. Shown to everyone on the
  // public landing page; price_estimates is publicly readable (RLS).
  const tileRatesBySector = await getTileRatesBySector();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <ImpactCounter stats={impact ?? undefined} />

        <div className="animate-fadeIn">
          <FlippingRates ratesBySector={tileRatesBySector} />
        </div>

        <HowItWorks />
        <FeaturesSection />
      </main>
      <Footer />
    </>
  );
}
