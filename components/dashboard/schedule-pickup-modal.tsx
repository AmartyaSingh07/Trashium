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
import { applyBoost } from "@/lib/pricing-math";
import type { WasteType } from "@/lib/types";

const wasteTypes: WasteType[] = [
  "Plastic",
  "Paper",
  "Glass",
  "Metal",
  "E-Waste",
  "Organic",
  "Mixed",
];
const OPERATIONAL_SECTORS = ['Rishra', 'Howrah', 'Shyamnagar', 'Tarakeswar', 'Hugli-Chinsura'];
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
  const weightRanges = [
    { label: "5-10 kg", value: "5-10 kg", midpoint: 7.5 },
    { label: "10-15 kg", value: "10-15 kg", midpoint: 12.5 },
    { label: "15-20 kg", value: "15-20 kg", midpoint: 17.5 },
    { label: "20+ kg", value: "20+ kg", midpoint: 25.0 },
  ];
  const [form, setForm] = useState({
    waste_type: "" as WasteType | "",
    estimated_weight: "",
    location: "",
    address: "",
    scheduled_date: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.waste_type || !form.location || !form.scheduled_date || !selectedTimeSlot) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        throw new Error("No active authenticated session found.");
      }

      const weight = weightRanges.find(r => r.value === form.estimated_weight)?.midpoint || 0;

      // Payout estimate from price_estimates (sector = area), boosted if a perk is pending. No hard-coded rates.
      let estimatedPrice: number | null = null;
      if (weight > 0) {
        const { data: rate } = await supabase
          .from("price_estimates")
          .select("price_per_kg")
          .eq("area", form.location)
          .eq("waste_type", form.waste_type)
          .maybeSingle();
        if (rate?.price_per_kg != null) {
          estimatedPrice = applyBoost(Number(rate.price_per_kg) * weight, boostPct);
        }
      }

      const { error } = await supabase.from("pickup_requests").insert({
        user_id: currentUser.id,
        full_name: userName,
        waste_type: form.waste_type,
        estimated_weight: weight,
        location: form.location,
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
        description: `${form.waste_type} pickup on ${form.scheduled_date}`,
      });

      setOpen(false);
      setForm({
        waste_type: "",
        estimated_weight: "",
        location: "",
        address: "",
        scheduled_date: "",
        notes: "",
      });
      setSelectedTimeSlot("");
      onScheduled?.();
    } catch (err) {
      console.error(err);
      toast.error("Failed to schedule pickup. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="lg"
            className="btn-terra h-12 px-8 text-base font-semibold gap-2 border-0"
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

          {/* Waste Type */}
          <div className="space-y-1.5">
            <Label htmlFor="waste_type" className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">
              Waste Type <span className="text-terra font-bold">*</span>
            </Label>
            <Select
              value={form.waste_type}
              onValueChange={(v) => {
                if (v !== null) setForm({ ...form, waste_type: v as WasteType });
              }}
            >
              <SelectTrigger id="waste_type" className="bg-linen/60 border-sand/55 text-bark placeholder:text-smoke/50 focus:border-terra focus:ring-terra focus:ring-1 focus-visible:ring-terra focus-visible:ring-1 focus-visible:outline-none">
                <SelectValue placeholder="Select waste type" />
              </SelectTrigger>
              <SelectContent className="bg-linen border-sand/40 text-bark">
                {wasteTypes.map((type) => (
                  <SelectItem key={type} value={type} className="hover:bg-sand/15 focus:bg-sand/15">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Weight Range */}
          <div className="space-y-1.5">
            <Label htmlFor="weight" className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">Estimated Weight Range</Label>
            <Select
              value={form.estimated_weight}
              onValueChange={(v) => {
                if (v !== null) setForm({ ...form, estimated_weight: v });
              }}
            >
              <SelectTrigger id="weight" className="bg-linen/60 border-sand/55 text-bark placeholder:text-smoke/50 focus:border-terra focus:ring-terra focus:ring-1 focus-visible:ring-terra focus-visible:ring-1 focus-visible:outline-none">
                <SelectValue placeholder="Select weight range" />
              </SelectTrigger>
              <SelectContent className="bg-linen border-sand/40 text-bark">
                {weightRanges.map((r) => (
                  <SelectItem key={r.value} value={r.value} className="hover:bg-sand/15 focus:bg-sand/15">
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
