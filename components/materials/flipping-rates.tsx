"use client";

import React, { useState } from "react";
import type { TileRatesBySector } from "@/lib/pricing";
import { Stagger, StaggerItem } from "@/components/motion";

interface RecyclableTier {
  id: string;
  /** Display name shown on the card. */
  name: string;
  /** Category label (top-left chip). */
  type: string;
  /** Exact filename (without extension) in the `flipping-rate-tiles` bucket. */
  file: string;
  /** Matching `material_type` in price_estimates (drives the live per-sector rate). */
  material: string;
  /** Witty eco line shown on the flipped back. */
  wit: string;
}

/**
 * One entry per .png in the Supabase `flipping-rate-tiles` bucket.
 * `file` matches the bucket object name exactly (spaces preserved); it is
 * URL-encoded at render time. `material` matches a `price_estimates.material_type`
 * so every tile shows the LIVE per-sector payout (no hardcoded prices -
 * see CLAUDE.md rule 3).
 */
const recyclableTiers: RecyclableTier[] = [
  { id: "ac-comp", name: "AC Compressor", type: "Appliance", file: "AC_compressor_icon", material: "AC Compressor", wit: "AC thanda nahi ho raha hai? Fikar not, rate abhi bhi garam hai!" },
  { id: "alu", name: "Aluminium Items", type: "Metal", file: "Alluminium items", material: "Aluminum", wit: "Aluminium halka hai toh kya hua, earning toh bhaari hai na!" },
  { id: "battery", name: "Battery", type: "Battery", file: "Battery", material: "Battery", wit: "Battery dead ho gayi? Tension nahi, value abhi bhi fully charged hai!" },
  { id: "brass", name: "Brass Items", type: "Metal", file: "Brass items icon", material: "Brass", wit: "Peetal purana ho sakta hai, par iska daam abhi bhi chamakta hai!" },
  { id: "card", name: "Cardboard", type: "Paper", file: "Cardboard_icon", material: "Cardboard", wit: "Dabba khali hai? Trashium pe becho, pocket bhari hai!" },
  { id: "copper", name: "Copper Items", type: "Metal", file: "Copper_items_icon", material: "Copper", wit: "Tambe ka taar ho ya pipe, Trashium pe milega rate bilkul right!" },
  { id: "ewaste", name: "E-Waste", type: "E-Waste", file: "E-waste_icon", material: "E-Waste", wit: "Trash collect karne se better cash collect karo!" },
  { id: "inv-bat", name: "Inverter Battery", type: "Battery", file: "Inverter Battery", material: "Inverter Battery", wit: "Backup khatam? Koi baat nahi, iska resale value abhi bhi on hai!" },
  { id: "iron", name: "Iron Items", type: "Metal", file: "Iron_items", material: "Iron", wit: "Ghar pe loha pada hai? Gate pe paisa bhi toh khada hai!" },
  { id: "news", name: "Newspaper", type: "Paper", file: "Newspaper_icon", material: "Newspaper", wit: "Headlines purana ho gaya toh kya hua, value abhi bhi karak hai!" },
  { id: "plastic", name: "Plastic Items", type: "Plastic", file: "Plastic_items_icon", material: "Plastic", wit: "Plastic joma kore ki hobe? Trashium e beche cash niye jao!" },
  { id: "steel", name: "Stainless Steel", type: "Metal", file: "Stainless_steel_icon", material: "Stainless Steel", wit: "Steel ka shine gaya? Par iska value abhi bhi fine hai!" },
  { id: "tin", name: "Tin Items", type: "Metal", file: "Tin items", material: "Tin", wit: "Tin ka dabba purana sahi, par paisa banane ka chance naya hai!" },
  { id: "ups-bat", name: "UPS Battery", type: "Battery", file: "UPS Battery", material: "UPS Battery", wit: "UPS backup nahi de raha? Trashium pe becho, cash zaroor de raha!" },
];


interface FlippingRatesProps {
  /** sector -> material_type -> price per kg, fetched server-side from price_estimates. */
  ratesBySector?: TileRatesBySector;
  /** Pre-selected sector (e.g. the logged-in household's). */
  defaultSector?: string;
}

export default function FlippingRates({
  ratesBySector = {},
  defaultSector,
}: FlippingRatesProps) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co";

  const sectors = Object.keys(ratesBySector);
  const initialSector =
    defaultSector && sectors.includes(defaultSector)
      ? defaultSector
      : sectors[0] ?? "";
  const [sector, setSector] = useState(initialSector);

  const sectorRates = ratesBySector[sector] ?? {};
  const rupee = "₹";
  const middot = " · ";

  return (
    <section id="rates" className="w-full max-w-6xl mx-auto py-10 px-4 text-center scroll-mt-24">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#C2703D] mb-2">
        Live scrap intelligence
      </p>
      <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-5">
        Operational Material Categories &amp; Rates
      </h2>

      {sectors.length > 0 && (
        <div className="flex items-center justify-center gap-2 mb-8">
          <label
            htmlFor="rate-sector"
            className="font-dm text-[11px] font-semibold uppercase tracking-wider text-[#6B5744]"
          >
            Rates for
          </label>
          <div className="relative">
            <select
              id="rate-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="appearance-none font-syne text-[13px] font-bold text-[#2A2218] bg-[#EDE5D8]/60 border border-[rgba(194,112,61,0.35)] rounded-full pl-4 pr-9 py-1.5 cursor-pointer hover:border-[#C2703D] focus:outline-none focus:ring-2 focus:ring-[#C2703D]/40 transition-colors"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#C2703D] text-[10px]">
              &#9660;
            </span>
          </div>
        </div>
      )}

      <Stagger className="flex flex-wrap justify-center gap-6 md:gap-8 lg:gap-10 mx-auto">
        {recyclableTiers.map((item) => {
          const imageUrl =
            supabaseUrl +
            "/storage/v1/object/public/flipping-rate-tiles/" +
            encodeURIComponent(item.file) +
            ".png";

          const price = sectorRates[item.material];
          const rateLabel = price != null ? rupee + price + "/kg" : "Rate on request";
          const backLabel = sector ? rateLabel + middot + sector : rateLabel;

          return (
            <StaggerItem
              key={item.id}
              className="group [perspective:1200px] cursor-pointer w-[200px] h-[212px]"
            >
              <div className="relative w-full h-full transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] group-hover:[transform:rotateY(180deg)]">
                <div className="absolute inset-0 w-full h-full rounded-[20px] p-5 [backface-visibility:hidden] bg-gradient-to-br from-[#F4EFE3]/70 to-[#EDE5D8]/40 border border-[rgba(194,112,61,0.18)] backdrop-blur-md flex flex-col justify-between shadow-[0_8px_24px_-12px_rgba(42,34,24,0.35)] overflow-hidden">
                  <span className="pointer-events-none absolute -inset-x-10 -top-16 h-24 rotate-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-y-40 transition-all duration-700" />

                  <div className="flex justify-between items-start w-full">
                    <span className="font-dm text-[10px] font-bold text-[#6B5744] uppercase tracking-wider">
                      {item.type}
                    </span>
                  </div>

                  <div className="my-1 flex justify-center items-center flex-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={item.name}
                      loading="lazy"
                      className="max-h-20 w-auto object-contain drop-shadow-[0_6px_10px_rgba(42,34,24,0.18)] transition-transform duration-300 group-hover:scale-[1.06]"
                    />
                  </div>

                  <div className="text-left w-full mt-auto">
                    <h3 className="font-syne text-[15px] font-bold text-[#2A2218] leading-tight">
                      {item.name}
                    </h3>
                    <div className="font-mono text-[10px] font-semibold text-[#4A6741] bg-[#8FA37E]/15 px-2 py-0.5 rounded w-fit mt-1.5">
                      {rateLabel}
                    </div>
                  </div>
                </div>

                <div className="absolute inset-0 w-full h-full rounded-[20px] p-5 [backface-visibility:hidden] [transform:rotateY(180deg)] bg-gradient-to-br from-[#2A2218] to-[#3A2E1F] border border-[#C2703D]/30 flex flex-col justify-between shadow-[0_12px_30px_-10px_rgba(42,34,24,0.6)]">
                  <div className="text-left w-full">
                    <span className="font-syne text-[9px] uppercase font-bold tracking-widest text-[#8FA37E]">
                      Ecosystem Insight
                    </span>
                  </div>

                  <p className="font-dm text-[11px] leading-relaxed text-[#F4EFE3] font-medium italic text-left">
                    {item.wit}
                  </p>

                  <div className="font-syne font-bold text-[10px] uppercase tracking-wider text-[#C2703D] mt-auto flex items-center gap-1 text-left">
                    {backLabel}
                  </div>
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
