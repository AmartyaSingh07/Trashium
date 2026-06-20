"use client";

/**
 * Price-grid monitor (Surface 4). Read-only view of the live price_estimates table — the ML output
 * admin oversees. Flags risk cells (profit/kg below min, or ₹0 payout). Pure read; no override here.
 */
import { OPERATIONAL_SECTORS } from "@/lib/constants";
import { MIN_MARGIN_PER_KG } from "@/lib/pricing-constants";
import type { PriceEstimate, WasteType } from "@/lib/types";

const WASTE_TYPES: WasteType[] = ["Plastic", "Paper", "Glass", "Metal", "E-Waste", "Organic", "Mixed"];

export default function PriceGrid({ estimates }: { estimates: PriceEstimate[] }) {
  const byKey = new Map(estimates.map((e) => [`${e.area}|${e.waste_type}`, e]));
  // Freshest publish across the grid (model version + when).
  const latest = estimates.reduce<PriceEstimate | null>(
    (acc, e) => (!acc || e.created_at > acc.created_at ? e : acc),
    null
  );

  const isRisk = (e: PriceEstimate | undefined) =>
    !e || e.price_per_kg === 0 || (e.profit_per_kg != null && e.profit_per_kg < MIN_MARGIN_PER_KG);

  return (
    <div className="w-full t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/40 border border-[rgba(194,112,61,0.18)] backdrop-blur-md shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218]">
          Price Grid Monitor
        </h2>
        {latest && (
          <span className="text-[10px] font-mono text-smoke">
            {latest.model_version ?? "unknown model"} · {new Date(latest.created_at).toLocaleDateString("en-IN")}
          </span>
        )}
      </div>

      <div className="rounded-xl border border-sand/25 overflow-x-auto">
        <table className="border-collapse w-full text-xs">
          <thead>
            <tr className="bg-[#EDE5D8]/50 border-b border-[#D4C5B0] text-[10px] font-bold uppercase tracking-wider text-[#6B5744]">
              <th className="py-2.5 px-3 text-left">Sector \\ Waste</th>
              {WASTE_TYPES.map((w) => (
                <th key={w} className="py-2.5 px-2 text-right">{w}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OPERATIONAL_SECTORS.map((sector) => (
              <tr key={sector} className="border-b border-sand/15 text-[#6B5744]">
                <td className="py-2 px-3 font-semibold text-bark">{sector}</td>
                {WASTE_TYPES.map((w) => {
                  const e = byKey.get(`${sector}|${w}`);
                  const risk = isRisk(e);
                  return (
                    <td
                      key={w}
                      title={
                        e
                          ? `market ₹${e.market_price_per_kg ?? "—"} · logistics ₹${e.logistics_per_kg ?? "—"} · profit ₹${e.profit_per_kg ?? "—"}`
                          : "no estimate"
                      }
                      className={`py-2 px-2 text-right font-mono ${
                        risk ? "bg-red-50 text-red-700 font-bold" : "text-[#2A2218]"
                      }`}
                    >
                      {e ? `₹${Number(e.price_per_kg).toFixed(2)}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-smoke">
        Red = payout ₹0 or profit below ₹{MIN_MARGIN_PER_KG.toFixed(2)}/kg. Hover a cell for market / logistics / profit.
      </p>
    </div>
  );
}
