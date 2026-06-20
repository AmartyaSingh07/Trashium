"use client";

/**
 * Price-grid monitor (Surface 4). Read-only view of the live price_estimates table — the ML output
 * admin oversees. Flags risk cells (profit/kg below min, or ₹0 payout). Pure read; no override here.
 *
 * Granular layout: 20 leaf MATERIALS as rows (grouped by category) × 5 SECTORS as columns. Keys on
 * (area, material_type). Bucket-only rows (Glass/Organic/Mixed, and legacy rows where material_type
 * = waste_type) still resolve because their material_type equals the label we look up.
 */
import { OPERATIONAL_SECTORS } from "@/lib/constants";
import { MIN_MARGIN_PER_KG } from "@/lib/pricing-constants";
import { WASTE_CATALOG } from "@/lib/waste-items";
import type { PriceEstimate } from "@/lib/types";

export default function PriceGrid({ estimates }: { estimates: PriceEstimate[] }) {
  // Prefer a granular (area|material_type) key; fall back to (area|waste_type) for older rows
  // that predate the material_type column.
  const byKey = new Map<string, PriceEstimate>();
  for (const e of estimates) {
    const mat = e.material_type ?? e.waste_type;
    byKey.set(`${e.area}|${mat}`, e);
    // also index by bucket so Glass/Organic/Mixed (no granular leaf) still resolve
    byKey.set(`${e.area}|${e.waste_type}`, byKey.get(`${e.area}|${e.waste_type}`) ?? e);
  }

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

      <div className="rounded-xl border border-sand/25 overflow-x-auto max-h-[28rem] overflow-y-auto">
        <table className="border-collapse w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#E4DAC8] border-b border-[#D4C5B0] text-[10px] font-bold uppercase tracking-wider text-[#6B5744]">
              <th className="py-2.5 px-3 text-left sticky left-0 bg-[#E4DAC8] z-20">Material \\ Sector</th>
              {OPERATIONAL_SECTORS.map((s) => (
                <th key={s} className="py-2.5 px-2 text-right">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WASTE_CATALOG.map((cat) => (
              <CategoryBlock
                key={cat.category}
                category={cat.category}
                materials={cat.items.map((i) => i.label)}
                byKey={byKey}
                isRisk={isRisk}
              />
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

function CategoryBlock({
  category,
  materials,
  byKey,
  isRisk,
}: {
  category: string;
  materials: string[];
  byKey: Map<string, PriceEstimate>;
  isRisk: (e: PriceEstimate | undefined) => boolean;
}) {
  return (
    <>
      <tr className="bg-[#EDE5D8]/60 border-b border-sand/20">
        <td
          colSpan={OPERATIONAL_SECTORS.length + 1}
          className="py-1.5 px-3 text-[9px] font-bold uppercase tracking-widest text-[#8C7A63] sticky left-0 bg-[#EDE5D8]/60"
        >
          {category}
        </td>
      </tr>
      {materials.map((mat) => (
        <tr key={mat} className="border-b border-sand/15 text-[#6B5744] hover:bg-white/30">
          <td className="py-2 px-3 font-semibold text-bark sticky left-0 bg-[#EDE5D8]/40">{mat}</td>
          {OPERATIONAL_SECTORS.map((sector) => {
            const e = byKey.get(`${sector}|${mat}`);
            const risk = isRisk(e);
            return (
              <td
                key={sector}
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
    </>
  );
}
