"use client";

import React from "react";

const recyclableTiers = [
  { id: "p-1", name: "PET Containers", type: "Plastic", rate: "5-10 kg", badge: "♳", wit: "Breaking up with your ex is hard, but breaking down in a landfill takes 450 years. Let's recycle!" },
  { id: "p-2", name: "Corrugated Boxes", type: "Paper", rate: "10-15 kg", badge: "📦", wit: "I’m great at holding secrets, shipping boxes, and staying out of local Hooghly rivers. Let's make a fresh sheet!" },
  { id: "p-3", name: "Aluminum Cans", type: "Metal", rate: "15-20 kg", badge: "🥫", wit: "I have infinite reincarnation potential. Melt me down, and I’ll be back on a retail shelf in 60 days flat." }
];

export default function FlippingRates() {
  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 text-center">
      {/* Section Subheading matching Syne specifications */}
      <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-6">
        Operational Material Categories & Rates
      </h2>

      {/* Grid Container spacing */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-4 py-6">
        {recyclableTiers.map((item) => (
          /* Outer Card Wrapper (Perspective Anchor) */
          <div
            key={item.id}
            className="group [perspective:1000px] cursor-pointer h-56 w-full"
          >
            {/* Card Rotator Inner element */}
            <div className="relative w-full h-full transition-all duration-500 [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
              
              {/* FRONT SIDE */}
              <div className="absolute inset-0 w-full h-full rounded-2xl p-6 [backface-visibility:hidden] bg-[#EDE5D8]/40 border border-[rgba(194,112,61,0.18)] backdrop-blur-md flex flex-col justify-between shadow-sm">
                {/* Top layout row */}
                <div className="flex justify-between items-start w-full">
                  <span className="font-dm text-xs font-bold text-[#6B5744] uppercase tracking-wider">
                    {item.type}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-[#8FA37E]/10 flex items-center justify-center text-base">
                    {item.badge}
                  </div>
                </div>

                {/* Bottom row typography layout */}
                <div className="text-left w-full mt-auto">
                  <h3 className="font-syne text-lg font-bold text-[#2A2218]">
                    {item.name}
                  </h3>
                  <div className="font-mono text-xs font-semibold text-[#4A6741] bg-[#8FA37E]/10 px-2 py-0.5 rounded w-fit mt-1">
                    {item.rate}
                  </div>
                </div>
              </div>

              {/* BACK SIDE */}
              <div className="absolute inset-0 w-full h-full rounded-2xl p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-[#2A2218] border border-[#C2703D]/30 flex flex-col justify-between shadow-xl">
                {/* Top layout row header */}
                <div className="text-left w-full">
                  <span className="font-syne text-[10px] uppercase font-bold tracking-widest text-[#8FA37E]">
                    Ecosystem Insight
                  </span>
                </div>

                {/* Center Copy block */}
                <p className="font-dm text-sm leading-relaxed text-[#F4EFE3] font-medium italic mt-2 text-left">
                  {item.wit}
                </p>

                {/* Bottom action tracker row */}
                <div className="font-syne font-bold text-[11px] uppercase tracking-wider text-[#C2703D] mt-auto flex items-center gap-1 text-left">
                  Book Payout Vector ↗
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
