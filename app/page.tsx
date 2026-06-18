import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import HeroSection from "@/components/landing/hero-section";
import ImpactCounter from "@/components/landing/impact-counter";
import HowItWorks from "@/components/landing/how-it-works";
import FeaturesSection from "@/components/landing/features-section";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  }

  const isHouseholdUser = profile?.role === "household";

  const { data: impact } = await supabase
    .from("global_impact")
    .select("*")
    .single();

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <ImpactCounter stats={impact ?? undefined} />

        {isHouseholdUser && (
          <div className="w-full max-w-5xl mx-auto py-12 px-4 text-center animate-fadeIn">
            <h2 className="font-syne font-bold text-xs uppercase tracking-widest text-[#2A2218] mb-8">
              ♻️ Operational Material Categories & Rates Matrix
            </h2>
            
            {/* 3D Flipping Card Matrix Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { id: "p1", name: "PET Containers", type: "Plastic", badge: "♳", rate: "₹12/kg", wit: "Breaking up with your ex is hard, but breaking down in a landfill takes 450 years. Let's recycle!" },
                { id: "p2", name: "Corrugated Boxes", type: "Paper", badge: "📦", rate: "₹8/kg", wit: "I’m great at holding secrets, shipping boxes, and staying out of local Hooghly rivers. Let's make a fresh sheet!" },
                { id: "p3", name: "Aluminum Cans", type: "Metal", badge: "🥫", rate: "₹45/kg", wit: "I have infinite reincarnation potential. Melt me down, and I’ll be back on a retail shelf in 60 days flat." }
              ].map((item) => (
                <div key={item.id} className="group [perspective:1000px] cursor-pointer h-56 w-full">
                  <div className="relative w-full h-full transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                    
                    {/* FRONT SIDE FRAME */}
                    <div className="absolute inset-0 w-full h-full rounded-2xl p-6 [backface-visibility:hidden] bg-[#EDE5D8]/40 border border-[rgba(194,112,61,0.18)] backdrop-blur-md flex flex-col justify-between shadow-sm">
                      <div className="flex justify-between items-start">
                        <span className="font-dm text-xs font-bold text-[#6B5744] uppercase tracking-wider">{item.type}</span>
                        <div className="w-8 h-8 rounded-full bg-[#8FA37E]/10 flex items-center justify-center text-base">{item.badge}</div>
                      </div>
                      <div className="text-left">
                        <h3 className="font-syne font-bold text-lg text-[#2A2218]">{item.name}</h3>
                        <span className="font-mono text-xs font-semibold text-[#4A6741] bg-[#8FA37E]/10 px-2 py-0.5 rounded w-fit mt-1 block">Est. Payout: {item.rate}</span>
                      </div>
                    </div>

                    {/* BACK SIDE FRAME (Witty Message) */}
                    <div className="absolute inset-0 w-full h-full rounded-2xl p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-[#2A2218] border border-[#C2703D]/30 flex flex-col justify-between shadow-xl">
                      <span className="font-syne text-[10px] uppercase font-bold tracking-widest text-[#8FA37E] text-left">Ecosystem Insight</span>
                      <p className="font-dm text-xs leading-relaxed text-[#F4EFE3] font-medium italic mt-2 text-left">{item.wit}</p>
                      <span className="font-syne font-bold text-[10px] uppercase tracking-wider text-[#C2703D] mt-auto text-left">Process Point ↗</span>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <HowItWorks />
        <FeaturesSection />
      </main>
      <Footer />
    </>
  );
}
