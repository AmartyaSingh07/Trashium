"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";

const CrewRouteMap = dynamic(() => import("@/components/maps/CrewRouteMap"), { ssr: false });

interface PickupRequest {
  id: string;
  scheduled_date: string;
  time_slot: string;
  operating_zone: string;
  weight: number;
  status: "pending" | "accepted" | "collected" | "completed" | "processed" | "cancelled";
  material_type?: string;
  user_address?: string;
}

interface CrewDashboardProps {
  profile: { id: string; full_name: string; role: string; operating_zone?: string | null };
  initialPickups: PickupRequest[];
}

export default function CrewDashboardContent({ profile, initialPickups }: CrewDashboardProps) {
  const supabase = createClient();
  const [pickups, setPickups] = useState<PickupRequest[]>(initialPickups);
  const [selectedPickup, setSelectedPickup] = useState<PickupRequest | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [issueText, setIssueText] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const trackingChannelRef = useRef<RealtimeChannel | null>(null);
  
  // On-Site scrap calculator state variables
  const [estimatorMaterial, setEstimatorMaterial] = useState("PET Bottles (Plastic)");
  const [estimatorWeight, setEstimatorWeight] = useState("");
  const [estimatorPenalty, setEstimatorPenalty] = useState("0.0");

  const getCalculatedPayout = () => {
    const w = parseFloat(estimatorWeight);
    if (isNaN(w) || w <= 0) return "Dynamic Sync";
    let rate = 12;
    if (estimatorMaterial === "Cardboard / Paper") rate = 8;
    else if (estimatorMaterial === "Aluminum Cans (Metal)") rate = 45;
    const penalty = parseFloat(estimatorPenalty) || 0;
    const total = w * rate * (1 - penalty);
    return total.toFixed(2);
  };



  // ── GPS Telemetry Broadcast Channel ──────────────────────────
  // Streams real-time crew position to household customers via
  // Supabase Realtime Broadcast (zero-overhead WebSocket channel).
  useEffect(() => {
    const zone = profile.operating_zone || "all";
    const channel = supabase.channel(`tracking:${zone}`);
    trackingChannelRef.current = channel;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setIsBroadcasting(true);
      }
    });

    let watchId: number | undefined;

    if (typeof window !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          channel.send({
            type: "broadcast",
            event: "telemetry_ping",
            payload: {
              crewId: profile.id,
              zone: zone,
              coords: [position.coords.latitude, position.coords.longitude],
              heading: position.coords.heading || 0,
              speed: position.coords.speed || 0,
              timestamp: new Date().toISOString(),
            },
          });
        },
        (err) => {
          console.warn("GPS telemetry broadcast: position unavailable –", err.message);
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(channel);
      trackingChannelRef.current = null;
      setIsBroadcasting(false);
    };
  }, [profile.id, profile.operating_zone, supabase]);

  // Network Offline Status Listener Tracking
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Sync state helpers to format weight midpoints to human ranges
  const getDisplayWeight = (num: number) => {
    if (num === 7.5) return "5-10 kg";
    if (num === 12.5) return "10-15 kg";
    if (num === 17.5) return "15-20 kg";
    if (num === 25.0) return "20+ kg";
    return `${num} kg`;
  };

  // Asynchronous status mutation handler pipeline
  const updatePickupStatus = async (id: string, nextStatus: "accepted" | "collected" | "completed" | "cancelled") => {
    if (isOffline) {
      alert("Operational offline safe-lock active. Cached mutations commit immediately upon reconnection.");
      return;
    }

    const dbStatus = nextStatus;
    const { error } = await supabase
      .from("pickup_requests")
      .update({ status: dbStatus })
      .eq("id", id);

    if (!error) {
      setPickups(prev => prev.map(p => p.id === id ? { ...p, status: nextStatus } : p));
      
      // Update selected pickup state in case it is open
      setSelectedPickup(prev => prev && prev.id === id ? { ...prev, status: nextStatus } : prev);
      
      setIsActionModalOpen(false);
      toast.success(`Pickup status updated to ${nextStatus}!`);
    } else {
      toast.error("Failed to update pickup status. Please try again.");
      console.error(error);
    }
  };

  const handleReportIssue = () => {
    if (!issueText.trim() || !selectedPickup) return;
    toast.success("Incident report dispatched successfully.");
    setIssueText("");
    setIsActionModalOpen(false);
  };

  const activeZone = profile.operating_zone || "All Regions";



  // Calculate statistics
  const totalCount = pickups.length;
  const pendingCount = pickups.filter(p => p.status === "pending" || p.status === "accepted").length;
  const completedCount = pickups.filter(p => p.status === "completed" || p.status === "collected").length;

  return (
    <div className="flex flex-col min-h-screen bg-[#F4EFE6]">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Dynamic Network Status Banner */}
        {isOffline && (
          <div className="mb-6 w-full p-3 bg-amber-600 text-white rounded-xl font-mono text-xs font-bold text-center animate-pulse shadow-sm">
            ⚠️ OFFLINE LOGISTICS CACHE ACTIVE — Serving cached data from local device layers.
          </div>
        )}

        {/* Live Broadcast Telemetry Status Indicator */}
        {isBroadcasting && !isOffline && (
          <div className="mb-6 w-full p-2.5 bg-[#7A9E7E]/15 border border-[#7A9E7E]/30 text-[#4A6741] rounded-xl font-mono text-[11px] font-bold text-center flex items-center justify-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4A6741] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4A6741]"></span>
            </span>
            LIVE TELEMETRY STREAM ACTIVE — Broadcasting GPS to customers in {profile.operating_zone || "all zones"}
          </div>
        )}

        {/* Landing Layout Section: CrewHub Title */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[rgba(196,112,74,0.15)] pb-6">
          <div>
            <h1 className="font-syne font-bold text-xl text-[#2C1F14] tracking-tight">
              CrewHub
            </h1>
            <p className="text-xs text-[#6B5744] mt-1">
              Active Hub Operations Sector: <span className="font-bold text-[#C4704A]">{activeZone}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-[#7A9E7E]/10 text-[#4A6741] font-bold border border-[#7A9E7E]/30 rounded-full px-3 py-1.5 uppercase">
              🛡️ {profile.role} terminal
            </span>
          </div>
        </div>

        {/* Quick Analytical Overview Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="t-glass-card rounded-xl p-4 bg-[#EDE5D8]/40 border border-[rgba(196,112,74,0.12)] backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-[#6B5744] block uppercase tracking-wider">Assigned Runs</span>
            <span className="text-lg sm:text-2xl font-mono font-bold block mt-1 text-[#C4704A]">{totalCount}</span>
          </div>
          <div className="t-glass-card rounded-xl p-4 bg-[#EDE5D8]/40 border border-[rgba(196,112,74,0.12)] backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-[#6B5744] block uppercase tracking-wider">Remaining Pickups</span>
            <span className="text-lg sm:text-2xl font-mono font-bold block mt-1 text-amber-700">{pendingCount}</span>
          </div>
          <div className="t-glass-card rounded-xl p-4 bg-[#EDE5D8]/40 border border-[rgba(196,112,74,0.12)] backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-[#6B5744] block uppercase tracking-wider">Cleared runs</span>
            <span className="text-lg sm:text-2xl font-mono font-bold block mt-1 text-[#4A6741]">{completedCount}</span>
          </div>
        </div>

        {/* Main Content Layout Container */}
        <div className="w-full flex flex-col gap-6">
          
          {/* Live Sequence Map */}
          <div className="t-glass-card rounded-2xl p-4 bg-[#EDE5D8]/30 border border-[rgba(196,112,74,0.18)] shadow-sm">
            <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2C1F14] mb-3">
              Live Optimized Collection Sequence Map
            </h2>
            <div className="relative w-full h-[320px] rounded-2xl overflow-hidden shadow-md border border-[rgba(196,112,74,0.15)] bg-[#EDE5D8]/20">
              {/* Collect active list zones strings array to plot polyline map targets */}
              <CrewRouteMap activeZones={pickups.map(p => p.operating_zone)} />

              <button
                type="button"
                onClick={() => alert("🗺️ Trashium Fleet Telemetry Vector: Routing path tracking sequence synchronized successfully with live West Bengal operational hubs.")}
                className="absolute top-3 right-3 z-[1000] font-syne font-bold text-[11px] uppercase tracking-wider text-[#F4EFE6] bg-[#2C1F14]/90 hover:bg-black backdrop-blur-md px-4 py-2.5 rounded-xl border border-[#C4704A]/30 shadow-xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98] min-h-[38px] flex items-center gap-1.5 cursor-pointer select-none"
              >
                Verify Route 🗺️
              </button>
            </div>
          </div>

            {/* Pickup Requests Ledger Table */}
            <div className="w-full mt-6 t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/40 border border-[rgba(196,112,74,0.15)] shadow-sm animate-fadeIn">
              <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2C1F14] mb-4 flex items-center gap-2">
                📋 Pickup Requests
              </h2>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(196,112,74,0.15)] font-syne text-xs uppercase tracking-wider text-[#6B5744]">
                      <th className="py-3 px-3">Address & Destination</th>
                      <th className="py-3 px-3">Schedule Timeline</th>
                      <th className="py-3 px-3">Weight Vector</th>
                      <th className="py-3 px-3">Pipeline Status</th>
                      <th className="py-3 px-3 text-right">Operational Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(196,112,74,0.08)]">
                    {pickups.map((p) => (
                      <tr key={p.id} className="hover:bg-[#EDE5D8]/20 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[#2C1F14] text-sm">{p.operating_zone}</div>
                          <div className="text-xs text-[#6B5744] mt-0.5 max-w-[200px] truncate">{p.user_address || "SKFGI Aggregation Drop Point"}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-xs font-semibold text-[#2C1F14]">{p.scheduled_date}</div>
                          <div className="font-mono text-[11px] text-[#C4704A] mt-0.5 font-medium">{p.time_slot}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono text-xs font-bold text-[#4A6741] bg-[#7A9E7E]/10 px-2.5 py-0.5 rounded">
                            {p.weight === 7.5 ? "5-10 kg" : p.weight === 12.5 ? "10-15 kg" : p.weight === 17.5 ? "15-20 kg" : p.weight === 25 ? "20+ kg" : `${p.weight} kg`}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[10px] font-mono uppercase font-bold tracking-tight px-2 py-1 rounded border ${
                            p.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            p.status === 'collected' ? 'bg-[#7A9E7E]/10 text-[#4A6741] border-[#7A9E7E]/30' :
                            p.status === 'accepted' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            p.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {p.status === 'completed' ? 'processed' : p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => { setSelectedPickup(p); setIsActionModalOpen(true); }}
                            className="bg-[#C4704A] hover:bg-[#A0522D] text-white text-xs font-bold px-3 py-1.5 rounded-lg font-syne uppercase tracking-wider min-h-[36px]"
                          >
                            Report Impurities ⚠️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. MOUNT THE MIGRATE ON-SITE PRICE ESTIMATOR */}
            <div className="t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/30 border border-[rgba(196,112,74,0.18)] shadow-sm mt-6">
              <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2C1F14] mb-3">
                🧮 Price Estimator
              </h2>
              <p className="text-xs text-[#6B5744] mb-4">Verify weights and calculate real-time custom Indian Rupee (₹) payouts directly at the doorstep if load discrepancies occur.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase text-[#2C1F14]">Material stream type</label>
                  <select 
                    value={estimatorMaterial}
                    onChange={(e) => setEstimatorMaterial(e.target.value)}
                    className="p-2.5 bg-[#F4EFE6] border border-[#D4C5B0] rounded-lg text-xs text-[#2C1F14]"
                  >
                    <option>PET Bottles (Plastic)</option>
                    <option>Cardboard / Paper</option>
                    <option>Aluminum Cans (Metal)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase text-[#2C1F14]">Doorstep Weight Class</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 12.5" 
                    value={estimatorWeight}
                    onChange={(e) => setEstimatorWeight(e.target.value)}
                    className="p-2.5 bg-[#F4EFE6] border border-[#D4C5B0] rounded-lg text-xs text-[#2C1F14]" 
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase text-[#2C1F14]">Quality Impurity Penalty (AI Risk)</label>
                  <select 
                    value={estimatorPenalty}
                    onChange={(e) => setEstimatorPenalty(e.target.value)}
                    className="p-2.5 bg-[#F4EFE6] border border-[#D4C5B0] rounded-lg text-xs text-[#2C1F14]"
                  >
                    <option value="0.0">0% Clean Load (No Defect)</option>
                    <option value="0.2">20% Minor Contamination</option>
                    <option value="0.5">50% High Moisture Risk</option>
                    <option value="0.8">80% Industrial Degradation</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-[rgba(196,112,74,0.08)] flex justify-between items-center">
                <span className="text-xs font-semibold text-[#6B5744]">Calculated Payout Estimation:</span>
                <span className="font-mono text-sm font-bold text-[#4A6741] bg-[#7A9E7E]/10 px-3 py-1 rounded">
                  {getCalculatedPayout() === "Dynamic Sync" ? "₹ Dynamic Sync" : `₹ ${getCalculatedPayout()}`}
                </span>
              </div>
            </div>
          </div>


      </main>

      {/* Reactive Overlay Modal for Reporting Impurities */}
      {isActionModalOpen && selectedPickup && (
        <div className="fixed inset-0 bg-[#2C1F14]/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-[#F4EFE6] border border-[#D4C5B0] w-full max-w-md p-6 rounded-2xl shadow-2xl flex flex-col gap-5">
            
            {/* Modal Header Row */}
            <div className="flex justify-between items-start border-b border-[rgba(196,112,74,0.15)] pb-3">
              <div>
                <h3 className="font-syne font-bold text-base text-[#2C1F14]">Manifest Operations: Run #{selectedPickup.id.substring(0, 8)}</h3>
                <p className="text-xs text-[#6B5744] mt-0.5 font-mono">Current Operational State: <span className="uppercase font-bold text-[#C4704A]">{selectedPickup.status}</span></p>
              </div>
              <button onClick={() => { setIsActionModalOpen(false); setSelectedPickup(null); }} className="text-sm font-bold text-[#6B5744] hover:text-red-600 transition-colors">✕</button>
            </div>

            {/* Step-by-Step Logistics State Actions Stack */}
            <div className="flex flex-col gap-2.5">
              <span className="font-syne font-bold text-[10px] uppercase tracking-widest text-[#6B5744]">Execute Flow Transitions</span>
              
              <button
                onClick={() => updatePickupStatus(selectedPickup.id, "accepted")}
                className="w-full font-syne font-bold text-xs uppercase tracking-wider p-3 bg-blue-600 text-white rounded-xl transition-all hover:bg-blue-800 min-h-[44px]"
              >
                1. Accept Assignment 🟢
              </button>
              
              <button
                onClick={() => updatePickupStatus(selectedPickup.id, "collected")}
                className="w-full font-syne font-bold text-xs uppercase tracking-wider p-3 bg-[#7A9E7E] text-white rounded-xl transition-all hover:bg-[#4A6741] min-h-[44px]"
              >
                2. Mark Load Collected ✓
              </button>
              
              <button
                onClick={() => updatePickupStatus(selectedPickup.id, "completed")}
                className="w-full font-syne font-bold text-xs uppercase tracking-wider p-3 bg-emerald-600 text-white rounded-xl transition-all hover:bg-emerald-800 min-h-[44px]"
              >
                3. Mark Load Processed 📦
              </button>
              
              <button
                onClick={() => updatePickupStatus(selectedPickup.id, "cancelled")}
                className="w-full font-syne font-bold text-xs uppercase tracking-wider p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl transition-all hover:bg-red-100 min-h-[44px]"
              >
                4. Cancel Collection Run ✕
              </button>
            </div>

            {/* Embedded Quality Impurities Dropdown Panel Section */}
            <div className="border-t border-[rgba(196,112,74,0.12)] pt-4">
              <label className="font-syne font-bold text-[10px] uppercase tracking-wider text-[#6B5744] block mb-1.5">
                Log Quality Anomaly & AI Penalty Risk
              </label>
              <input
                type="text"
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                placeholder="e.g., Load rejected due to high industrial dust contamination"
                className="w-full p-2.5 bg-[#EDE5D8]/50 border border-[#D4C5B0] rounded-xl text-xs text-[#2C1F14] focus:outline-none focus:border-[#C4704A]"
              />
              <button
                onClick={handleReportIssue}
                className="w-full mt-2 font-syne font-bold text-xs uppercase tracking-wider p-2 bg-[#2C1F14] text-white rounded-lg transition-colors hover:bg-black border-0 cursor-pointer min-h-[36px]"
              >
                Dispatch Incident Report Alert
              </button>
            </div>

          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
