"use client";

/**
 * Admin payout estimator + override (Surface 3). Supervisory tool, not a peer calculator:
 * admin picks a PENDING pickup, sees the system-computed payout via the shared estimateQuote()
 * seam, and may override the final number. The override is the authoritative payout for that
 * pickup (authoritative = payout_override ?? estimated_price) and writes back via the admin-only
 * set_payout_override RPC. Margin is admin-only here (household/crew never see it).
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { estimateQuote } from "@/lib/estimate";
import { MIN_MARGIN_PER_KG } from "@/lib/pricing-constants";
import type { EstimateResult, RiskLevel } from "@/lib/estimator-types";
import type { PickupRequest, WasteType } from "@/lib/types";
import { toast } from "sonner";

const LEVEL_BUCKET_BASE = `${
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co"
}/storage/v1/object/public/gamification-levels`;

const RISKS: RiskLevel[] = ["Low", "Medium", "High"];

export default function PayoutOverride({
  pickups,
  onSaved,
}: {
  pickups: PickupRequest[];
  onSaved: (id: string, override: number | null) => void;
}) {
  const supabase = createClient();
  const pending = pickups.filter((p) => p.status === "pending");

  const [selectedId, setSelectedId] = useState("");
  const [risk, setRisk] = useState<RiskLevel>("Medium");
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [overrideStr, setOverrideStr] = useState("");
  const [computing, setComputing] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = pending.find((p) => p.id === selectedId) ?? null;

  const compute = async (pickup: PickupRequest, r: RiskLevel) => {
    setComputing(true);
    try {
      const res = await estimateQuote({
        wasteType: pickup.waste_type as WasteType,
        sector: pickup.location,
        quantityKg: Number(pickup.estimated_weight),
        risk: r,
      });
      setResult(res);
    } catch {
      toast.error("Failed to compute estimate.");
      setResult(null);
    } finally {
      setComputing(false);
    }
  };

  const onSelect = (id: string) => {
    setSelectedId(id);
    setResult(null);
    const p = pending.find((x) => x.id === id);
    if (!p) return;
    setOverrideStr(p.payout_override != null ? String(p.payout_override) : "");
    void compute(p, risk);
  };

  const onRiskChange = (r: RiskLevel) => {
    setRisk(r);
    if (selected) void compute(selected, r);
  };

  // Real platform margin/kg if admin pays `overrideTotal` for this pickup:
  //   marketValue/kg − logistics/kg − payout/kg.  Warn when it dips below MIN_MARGIN_PER_KG.
  const overrideNum = overrideStr.trim() === "" ? null : Number(overrideStr);
  const qty = selected ? Number(selected.estimated_weight) : 0;
  const overrideMarginPerKg =
    result && overrideNum != null && qty > 0
      ? result.marketValuePerKg - result.logisticsPerKg - overrideNum / qty
      : null;
  const overrideBelowMin = overrideMarginPerKg != null && overrideMarginPerKg < MIN_MARGIN_PER_KG;

  const save = async () => {
    if (!selected) return;
    if (overrideNum != null && (Number.isNaN(overrideNum) || overrideNum < 0)) {
      return toast.error("Enter a valid payout (₹0 or more), or clear it.");
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("set_payout_override", {
      p_pickup_id: selected.id,
      p_amount: overrideNum,
    });
    setSaving(false);
    if (error || !(data as { ok?: boolean })?.ok) {
      return toast.error("Failed to save override.");
    }
    onSaved(selected.id, overrideNum);
    toast.success(overrideNum == null ? "Override cleared." : "Payout override saved.");
  };

  const money = (n: number) => `₹${n.toFixed(2)}`;
  const authoritative = selected
    ? selected.payout_override ?? selected.estimated_price ?? null
    : null;

  return (
    <div className="w-full t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/30 border border-[rgba(194,112,61,0.15)] backdrop-blur-md shadow-sm">
      <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-4 flex items-center gap-2">
        <img src={`${LEVEL_BUCKET_BASE}/price-estimator.png`} alt="" className="h-6 w-6 object-contain" />
        Payout Estimator &amp; Override
      </h2>

      {pending.length === 0 ? (
        <p className="py-8 text-center text-xs text-smoke italic">No pending pickups to review.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Pickup selector */}
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1 text-[11px] font-bold uppercase tracking-wider text-[#6B5744]">
              Pending pickup
              <select
                value={selectedId}
                onChange={(e) => onSelect(e.target.value)}
                className="mt-1 w-full bg-linen/60 border border-sand/55 rounded-lg text-[12px] p-2 text-bark cursor-pointer focus:outline-none focus:border-terra font-normal normal-case"
              >
                <option value="" disabled>Select a pickup…</option>
                {pending.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id.substring(0, 8)} · {p.waste_type} · {p.location} · {Number(p.estimated_weight)}kg
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#6B5744]">
              Quality risk
              <select
                value={risk}
                onChange={(e) => onRiskChange(e.target.value as RiskLevel)}
                disabled={!selected}
                className="mt-1 w-full bg-linen/60 border border-sand/55 rounded-lg text-[12px] p-2 text-bark cursor-pointer focus:outline-none focus:border-terra font-normal normal-case disabled:opacity-50"
              >
                {RISKS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Computed result (read-only) */}
          {computing ? (
            <p className="text-xs text-smoke italic">Computing…</p>
          ) : result && selected ? (
            <div className="rounded-xl border border-sand/25 bg-white/40 p-4 text-xs text-[#6B5744]">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <Stat label="System payout" value={money(result.userPayoutTotal)} strong />
                <Stat label="Payout / kg" value={money(result.userPayoutPerKg)} />
                <Stat label="Margin / kg" value={money(result.marginPerKg)} />
                <Stat label="Distance" value={`${result.distanceKm} km`} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#EDE5D8] text-[#6B5744] border border-sand/40">
                  source: {result.source}{result.modelVersion ? ` · ${result.modelVersion}` : ""}
                </span>
                {result.belowMinMargin && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                    system margin below ₹{MIN_MARGIN_PER_KG.toFixed(2)}/kg
                  </span>
                )}
              </div>

              {/* Override */}
              <div className="mt-4 border-t border-[rgba(194,112,61,0.15)] pt-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-terra">
                  Manual override (₹ total) — admin authority
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={overrideStr}
                    onChange={(e) => setOverrideStr(e.target.value)}
                    placeholder={result.userPayoutTotal.toFixed(2)}
                    className="w-36 bg-linen/60 border border-terra/40 rounded-lg text-[13px] p-2 text-bark font-mono focus:outline-none focus:border-terra"
                  />
                  <button
                    onClick={save}
                    disabled={saving}
                    className="bg-[#C2703D] hover:bg-[#A0522D] text-white text-[11px] font-bold px-4 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save override"}
                  </button>
                  {overrideStr.trim() !== "" && (
                    <button
                      onClick={() => setOverrideStr("")}
                      className="text-[11px] font-semibold text-smoke hover:text-bark underline"
                    >
                      clear
                    </button>
                  )}
                  {overrideBelowMin && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-300">
                      override drops margin below ₹{MIN_MARGIN_PER_KG.toFixed(2)}/kg
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px]">
                  Authoritative payout:{" "}
                  <span className="font-mono font-bold text-[#2A2218]">
                    {authoritative != null ? money(authoritative) : "—"}
                  </span>
                  {selected.payout_override != null && (
                    <span className="ml-1 text-terra">(overridden)</span>
                  )}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-smoke font-sans">{label}</p>
      <p className={`mt-0.5 ${strong ? "text-base font-bold text-[#2A2218]" : "text-sm text-bark"}`}>{value}</p>
    </div>
  );
}
