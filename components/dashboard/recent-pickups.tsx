"use client";

import { useState } from "react";
import StatusBadge from "@/components/ui/StatusBadge";
import type { PickupRequest } from "@/lib/types";

const getDisplayWeight = (weightNum: number | string) => {
  const num = typeof weightNum === 'string' ? parseFloat(weightNum) : weightNum;
  if (num === 7.5) return "5-10 kg";
  if (num === 12.5) return "10-15 kg";
  if (num === 17.5) return "15-20 kg";
  if (num === 25.0) return "20+ kg";
  return `${num} kg`; // Fallback for historical precise records
};

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

interface RecentPickupsProps {
  pickups: PickupRequest[];
  onCancel?: (pickupId: string, pickup: PickupRequest) => void;
  onReschedule?: (pickupId: string, newDate: string, newTimeSlot: string) => void;
}

export default function RecentPickups({ pickups, onCancel, onReschedule }: RecentPickupsProps) {
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTimeSlot, setRescheduleTimeSlot] = useState("");
  const selectedPickup = pickups.find(p => p.id === rescheduleId);

  if (pickups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center font-[family-name:var(--font-dm)]">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-sm font-medium text-bark">
          No pickups yet
        </p>
        <p className="text-xs text-smoke mt-1">
          Schedule your first pickup to start earning Green Credits!
        </p>
      </div>
    );
  }

  const canShowActions = (status: string) => {
    return status === "pending" || status === "accepted" || status === "confirmed";
  };

  return (
    <div className="space-y-3.5">
      {pickups.slice(0, 5).map((pickup) => (
        <div
          key={pickup.id}
          className="flex flex-col p-4 rounded-xl border border-sand/25 bg-linen/40 hover:bg-linen/80 hover:shadow-sm transition-all duration-200 gap-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-terra/10 font-[family-name:var(--font-syne)] text-sm font-bold text-terra">
                {pickup.waste_type.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-0.5">
                <h4 className="font-[family-name:var(--font-syne)] text-sm font-semibold text-bark">
                  {pickup.waste_type} Waste
                </h4>
                <p className="text-xs text-smoke font-[family-name:var(--font-dm)]">
                  Est. Weight:{" "}
                  <span className="font-[family-name:var(--font-jetbrains)] text-clay font-medium">
                    {getDisplayWeight(pickup.estimated_weight)}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 border-sand/15 pt-2.5 sm:pt-0">
              <div className="flex flex-col gap-1 text-left">
                <span className="font-dm text-sm font-semibold text-[#2A2218]">
                  {new Date(pickup.scheduled_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {pickup.time_slot ? (
                  <span className="font-mono text-xs font-medium text-[#8FA37E] bg-[#8FA37E]/10 px-2 py-0.5 rounded w-fit">
                    ⏰ {pickup.time_slot}
                  </span>
                ) : (
                  <span className="font-dm text-xs text-[#6B5744] italic">Standard Hours</span>
                )}
              </div>
              <StatusBadge status={pickup.status} />
            </div>
          </div>

          {/* Action buttons for pending/accepted requests */}
          {canShowActions(pickup.status as string) && (onCancel || onReschedule) && (
            <div className="flex items-center gap-2 pt-1 border-t border-sand/15">
              {onReschedule && (
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleId(rescheduleId === pickup.id ? null : pickup.id);
                    setRescheduleDate("");
                    setRescheduleTimeSlot("");
                  }}
                  className="text-xs font-semibold text-[#C2703D] hover:text-[#B35E39] transition-colors cursor-pointer bg-transparent border-0 px-0"
                >
                  Reschedule
                </button>
              )}
              {onReschedule && onCancel && (
                <span className="text-sand text-xs">•</span>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={() => onCancel(pickup.id, pickup)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors cursor-pointer bg-transparent border-0 px-0"
                >
                  Cancel
                </button>
              )}
            </div>
          )}


        </div>
      ))}

      {/* Reschedule slide-over modal container */}
      {rescheduleId && selectedPickup && onReschedule && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity duration-300">
          <style>{`
            @keyframes slideInRight {
              from {
                transform: translateX(100%);
              }
              to {
                transform: translateX(0);
              }
            }
            .animate-slideInRight {
              animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          <div className="fixed inset-0 bg-transparent" onClick={() => {
            setRescheduleId(null);
            setRescheduleDate("");
            setRescheduleTimeSlot("");
          }} />
          <div className="relative w-full max-w-md bg-linen border-l border-sand/40 h-full p-6 shadow-2xl flex flex-col justify-between animate-slideInRight font-[family-name:var(--font-dm)]">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-sand/20 pb-4">
                <h3 className="font-syne font-bold text-lg text-bark">Reschedule Pickup</h3>
                <button 
                  type="button" 
                  onClick={() => {
                    setRescheduleId(null);
                    setRescheduleDate("");
                    setRescheduleTimeSlot("");
                  }}
                  className="text-smoke hover:text-bark text-xl font-bold cursor-pointer bg-transparent border-0"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-sand/10 rounded-xl p-3.5 border border-sand/20 space-y-1">
                  <span className="text-xs uppercase tracking-wider text-smoke font-[family-name:var(--font-syne)] font-semibold">Current Schedule</span>
                  <p className="text-sm font-semibold text-bark font-[family-name:var(--font-jetbrains)]">
                    {selectedPickup.waste_type} Waste — {new Date(selectedPickup.scheduled_date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="reschedule-date" className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">
                    New Date <span className="text-terra font-bold">*</span>
                  </label>
                  <input
                    id="reschedule-date"
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-sand/55 bg-linen/60 text-bark text-sm focus:border-terra focus:ring-terra focus:ring-1 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="reschedule-timeslot" className="text-xs font-semibold uppercase tracking-wider text-bark font-[family-name:var(--font-syne)]">
                    Preferred Collection Time <span className="text-terra font-bold">*</span>
                  </label>
                  <select 
                    id="reschedule-timeslot"
                    value={rescheduleTimeSlot}
                    onChange={(e) => setRescheduleTimeSlot(e.target.value)}
                    required
                    className="w-full p-2.5 mt-2 bg-[#EDE5D8]/60 border border-[#D4C5B0] rounded-lg font-dm text-sm text-[#2A2218]"
                  >
                    <option value="" disabled>Select an available transit slot</option>
                    {TRASHIUM_PICKUP_SLOTS.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

             <div className="flex gap-3 border-t border-sand/20 pt-4">
              <button
                type="button"
                onClick={() => {
                  setRescheduleId(null);
                  setRescheduleDate("");
                  setRescheduleTimeSlot("");
                }}
                className="flex-1 px-4 py-3 rounded-xl border border-sand/40 hover:bg-sand/10 text-bark font-semibold transition-colors text-sm cursor-pointer bg-transparent"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rescheduleDate || !rescheduleTimeSlot}
                onClick={() => {
                  if (rescheduleDate && rescheduleTimeSlot) {
                    onReschedule(selectedPickup.id, rescheduleDate, rescheduleTimeSlot);
                    setRescheduleId(null);
                    setRescheduleDate("");
                    setRescheduleTimeSlot("");
                  }
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-[#C2703D] hover:bg-[#B35E39] text-white font-semibold transition-colors text-sm border-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
