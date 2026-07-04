"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarPlus, Loader2, Sparkles } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { estimateMultiQuote } from "@/lib/estimate";
import type { EstimateResult, RiskLevel } from "@/lib/estimator-types";
import { WASTE_CATALOG, toEntries, totalKg, dominantBucket } from "@/lib/waste-items";
import { OPERATIONAL_SECTORS, SECTOR_DEPOTS } from "@/lib/constants";

const LEVEL_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co"}/storage/v1/object/public/gamification-levels`;

const TRASHIUM_PICKUP_SLOTS = [
  "08:00 AM - 09:00 AM",
  "09:30 AM - 10:30 AM",
  "11:00 AM - 12:00 PM",
  "12:30 PM - 01:30 PM",
  "02:00 PM - 03:00 PM",
  "03:30 PM - 04:30 PM",
  "05:00 PM - 06:00 PM",
  "06:30 PM - 07:30 PM",
  "07:30 PM - 08:30 PM"
];

interface SchedulePickupModalProps {
  userId: string;
  userName: string;
  onScheduled?: () => void;
}

export default function SchedulePickupModal({
  userId,
  userName,
  onScheduled,
}: SchedulePickupModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [boostPct, setBoostPct] = useState<number | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const handleOpen = () => {
      setOpen(true);
    };
    window.addEventListener("open-schedule-pickup", handleOpen);
    return () => {
      window.removeEventListener("open-schedule-pickup", handleOpen);
    };
  }, []);

  // Module F: surface any pending payout boost so it can be applied to this pickup.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("pending_payout_boost_pct")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setBoostPct(data?.pending_payout_boost_pct ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, open]);
  const [form, setForm] = useState({
    waste_items: [] as string[],
    item_kg: {} as Record<string, string>, // per-material weight (kg), keyed by leaf label
    location: "",
    address: "",
    scheduled_date: "",
    notes: "",
    risk: "Medium" as RiskLevel,
    pincode: "",
  });
  const [estResult, setEstResult] = useState<EstimateResult | null>(null);

  // Live payout preview — sums each material's quote, logistics charged once. No hardcoded rates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!form.waste_items.length || !form.location || totalKg(form.waste_items, form.item_kg) <= 0) {
        if (!cancelled) setEstResult(null);
        return;
      }
      try {
        const r = await estimateMultiQuote({
          entries: toEntries(form.waste_items, form.item_kg),
          sector: form.location,
          risk: form.risk,
          pincode: form.pincode || undefined,
          boostPct,
        });
        if (!cancelled) setEstResult(r);
      } catch { if (!cancelled) setEstResult(null); }
    })();
    return () => { cancelled = true; };
  }, [form.waste_items, form.item_kg, form.location, form.risk, form.pincode, boostPct]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weight = totalKg(form.waste_items, form.item_kg);
    if (!form.waste_items.length || weight <= 0 || !form.location || !form.scheduled_date || !selectedTimeSlot) {
      toast.error("Add a weight for each material and fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error("No active authenticated session found.");
      }

      // Payout = sum of each material's quote, logistics charged once. No hard-coded rates.
      const q = await estimateMultiQuote({
        entries: toEntries(form.waste_items, form.item_kg),
        sector: form.location,
        risk: form.risk,
        pincode: form.pincode || undefined,
        boostPct,
      });
      const estimatedPrice: number | null = q.userPayoutTotal;

      // Sector-centre coordinates so the crew route map can plot the stop.
      const depot = SECTOR_DEPOTS[form.location];

      const { error } = await supabase.from("pickup_requests").insert({
        user_id: currentUser.id,
        full_name: userName,
        waste_type: dominantBucket(form.waste_items, form.item_kg), // valid pricing bucket for all downstream consumers
        waste_items: form.waste_items,
        estimated_weight: weight,
        location: form.location,
        latitude: depot?.lat ?? null,
        longitude: depot?.lng ?? null,
        address: form.address,
        scheduled_date: form.scheduled_date,
        time_slot: selectedTimeSlot,
        notes: form.notes,
        estimated_price: estimatedPrice,
        status: "pending", // Default initialization state
      });

      if (error) throw error;

      // Module F: one-time use — clear the pending boost once it has been baked into a pickup payout.
      if (boostPct != null && estimatedPrice != null) {
        await supabase
          .from("profiles")
          .update({ pending_payout_boost_pct: null })
          .eq("id", currentUser.id);
        setBoostPct(null);
      }

      toast.success("Pickup scheduled successfully!", {
        description: `${form.waste_items.join(", ")} pickup on ${form.scheduled_date}`,
      });

      setOpen(false);
      setForm({
        waste_items: [],
        item_kg: {},
        location: "",
        address: "",
        scheduled_date: "",
        notes: "",
        risk: "Medium",
        pincode: "",
      });
      setEstResult(null);
      setSelectedTimeSlot("");
      onScheduled?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to schedule pickup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (label: string) =>
    setForm((f) => {
      const has = f.waste_items.includes(label);
      const item_kg = { ...f.item_kg };
      if (has) delete item_kg[label]; // drop its weight when deselected
      return {
        ...f,
        waste_items: has ? f.waste_items.filter((x) => x !== label) : [...f.waste_items, label],
        item_kg,
      };
    });

  const setItemKg = (label: string, kg: string) =>
    setForm((f) => ({ ...f, item_kg: { ...f.item_kg, [label]: kg } }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="lg"
            className="btn-terra h-12 px-8 text-base font-semibold gap-2 border-0 t-lift t-focus-ring"
          />
        }
      >
        <CalendarPlus className="h-5 w-5" />
        Schedule a Pickup
      </DialogTrigger>

      <DialogContent className="sm:max-w-md bg-linen border-sand/35 font-[family-name:var(--font-dm)]">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-syne)] text-xl font-bold text-bark">Schedule a Pickup</DialogTitle>
          <DialogDescription className="text-sm text-smoke font-[family-name:var(--font-dm)]">
            Fill in the details and we&apos;ll send a verified collector to your
            doorstep.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {boostPct != null && (
            <div className="flex items-center gap-2 rounded-lg border border-[#8FA37E]/40 bg-[#8FA37E]/10 px-3 py-2 text-xs font-semibold text-[#4A6741]">
              <Sparkles className="h-3.5 w-3.5" />
              Payout boost active (+{boostPct}%) — applied to this pickup.
            </div>
          )}

          {/* Materials — grouped multi-select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">
              Materials <span className="text-terra font-bold">*</span>
              {form.waste_items.length > 0 && (
                <span className="ml-1 font-normal normal-case tracking-normal text-smoke">
                  · {form.waste_items.length} selected · {totalKg(form.waste_items, form.item_kg)} kg
                </span>
              )}
            </Label>
            <p className="text-[11px] text-[#8C7A63]">Pick each material and enter its weight (kg) — your payout adds up across all of them.</p>

            {form.waste_items.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.waste_items.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleItem(label)}
                    className="inline-flex items-center gap-1 rounded-full bg-terra/15 px-2.5 py-1 text-xs font-medium text-bark transition-colors hover:bg-terra/25"
                  >
                    {label}
                    <span aria-hidden className="text-terra">×</span>
                    <span className="sr-only">Remove {label}</span>
                  </button>
                ))}
              </div>
            )}

            <div
              role="group"
              aria-label="Select materials"
              className="max-h-56 overflow-y-auto rounded-lg border border-sand/55 bg-linen/60"
            >
              {WASTE_CATALOG.map((cat) => (
                <div key={cat.category}>
                  <div className="sticky top-0 z-10 bg-linen px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-smoke font-[family-name:var(--font-syne)] border-b border-sand/30">
                    {cat.category}
                  </div>
                  {cat.items.map((it) => {
                    const checked = form.waste_items.includes(it.label);
                    const id = `m-${it.label.replace(/\s+/g, "-")}`;
                    return (
                      <div
                        key={it.label}
                        className="flex min-h-11 items-center gap-2.5 px-3 py-2 text-sm text-bark transition-colors hover:bg-sand/15"
                      >
                        <input
                          id={id}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(it.label)}
                          className="h-4 w-4 shrink-0 accent-[#C2703D] cursor-pointer"
                        />
                        <label htmlFor={id} className={`flex-1 cursor-pointer ${checked ? "font-medium" : ""}`}>
                          {it.label}
                        </label>
                        {checked && (
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.5"
                            placeholder="kg"
                            value={form.item_kg[it.label] ?? ""}
                            onChange={(e) => setItemKg(it.label, e.target.value)}
                            aria-label={`${it.label} weight in kilograms`}
                            className="w-16 shrink-0 rounded-md border border-sand/55 bg-linen px-2 py-1 text-right text-xs text-bark focus:border-terra focus:outline-none"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>


          {/* Quality Risk */}
          <div className="flex flex-col gap-1.5">
            <label className="font-syne font-bold text-xs uppercase tracking-wider text-[#2A2218]">
              Quality Risk
            </label>
            <select
              value={form.risk}
              onChange={(e) => setForm({ ...form, risk: e.target.value as RiskLevel })}
              className="w-full font-dm text-sm p-3 bg-linen/60 border border-sand/55 rounded-lg text-[#2A2218] focus:outline-none focus:border-[#C2703D] transition-colors appearance-none cursor-pointer"
            >
              <option value="Low">Low — clean, well-sorted</option>
              <option value="Medium">Medium — some contamination</option>
              <option value="High">High — mixed / soiled</option>
            </select>
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">
              Location / Area <span className="text-terra font-bold">*</span>
            </Label>
            <Select
              value={form.location}
              onValueChange={(v) => {
                if (v !== null) setForm({ ...form, location: v });
              }}
            >
              <SelectTrigger id="location" className="bg-linen/60 border-sand/55 text-bark placeholder:text-smoke/50 focus:border-terra focus:ring-terra focus:ring-1 focus-visible:ring-terra focus-visible:ring-1 focus-visible:outline-none">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent className="bg-linen border-sand/40 text-bark">
                {OPERATIONAL_SECTORS.map((sector) => (
                  <SelectItem key={sector} value={sector} className="hover:bg-sand/15 focus:bg-sand/15">
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">Full Address</Label>
            <Input
              id="address"
              placeholder="e.g., #42, 3rd Cross, MG Road"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="bg-linen/60 border-sand/55 text-bark placeholder:text-smoke/50 focus:border-terra focus:ring-terra focus:ring-1 focus-visible:ring-terra focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>

          {/* Pincode (distance hint for logistics; optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="pincode" className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">Pincode</Label>
            <Input
              id="pincode"
              inputMode="numeric"
              placeholder="e.g., 712248"
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              className="bg-linen/60 border-sand/55 text-bark placeholder:text-smoke/50 focus:border-terra focus:ring-terra focus:ring-1 focus-visible:ring-terra focus-visible:ring-1 focus-visible:outline-none"
            />
            <span className="text-[11px] text-[#8C7A63]">Used to estimate pickup logistics; sector distance is used if left blank.</span>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="date" className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">
              Preferred Date <span className="text-terra font-bold">*</span>
            </Label>
            <Input
              id="date"
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={form.scheduled_date}
              onChange={(e) =>
                setForm({ ...form, scheduled_date: e.target.value })
              }
              className="bg-linen/60 border-sand/55 text-bark placeholder:text-smoke/50 focus:border-terra focus:ring-terra focus:ring-1 focus-visible:ring-terra focus-visible:ring-1 focus-visible:outline-none"
            />
          </div>

          {/* Time Slot Selector */}
          <div className="flex flex-col gap-1.5 w-full mt-4">
            <label className="font-syne font-bold text-xs uppercase tracking-wider text-[#2A2218]">
              Preferred Collection Time <span className="text-terra font-bold">*</span>
            </label>
            <select 
              value={selectedTimeSlot}
              onChange={(e) => setSelectedTimeSlot(e.target.value)}
              required
              className="w-full font-dm text-sm p-3 bg-linen/60 border border-sand/55 rounded-lg text-[#2A2218] focus:outline-none focus:border-[#C2703D] transition-colors appearance-none cursor-pointer"
            >
              <option value="" disabled>Select an available transit slot</option>
              {TRASHIUM_PICKUP_SLOTS.map((slot) => (
                <option key={slot} value={slot}>{slot}</option>
              ))}
            </select>
            <span className="font-dm text-[11px] text-[#6B5744] italic mt-0.5">
              * Gaps account for crew navigation timelines across Hooghly and Howrah.
            </span>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any special instructions..."
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-linen/60 border-sand/55 text-bark placeholder:text-smoke/50 focus:border-terra focus:ring-terra focus:ring-1 focus-visible:ring-terra focus-visible:ring-1 focus-visible:outline-none resize-none"
            />
          </div>

          {/* Live payout preview */}
          <div className="rounded-xl border border-sand/40 bg-[#F4EFE3]/70 px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <img src={`${LEVEL_BUCKET_BASE}/price-estimator.png`} alt="" className="h-7 w-7 object-contain" loading="lazy" />
              <span className="font-syne font-bold text-xs uppercase tracking-wider text-bark">Payout Estimate</span>
            </div>
            {estResult ? (
              <>
                <p className="font-[family-name:var(--font-jetbrains)] text-3xl font-bold text-[#4A6741] leading-none">
                  ₹<AnimatedNumber value={estResult.userPayoutTotal} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }} />
                </p>
                <p className="text-[11px] text-[#8C7A63] mt-1">
                  ₹{estResult.userPayoutPerKg.toFixed(2)}/kg · logistics ₹{estResult.logisticsPerKg.toFixed(2)}/kg · {estResult.distanceKm} km
                </p>
              </>
            ) : (
              <p className="text-xs text-[#8C7A63]">Select materials, enter their weights and pick an area to see your payout.</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-sand/40 hover:bg-sand/10 text-bark font-semibold rounded-full px-5"
            >
              Cancel
            </Button>
            <button
              type="submit"
              disabled={loading}
              className="btn-terra text-xs px-6 py-2.5 flex items-center justify-center gap-1.5 border-0 cursor-pointer"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {loading ? "Scheduling..." : "Confirm Pickup"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
