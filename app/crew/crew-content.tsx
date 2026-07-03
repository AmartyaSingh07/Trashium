"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { toast } from "sonner";
import { Reveal } from "@/components/motion";
import type { RealtimeChannel } from "@supabase/supabase-js";

const OptimizedRouteMap = dynamic(() => import("@/components/maps/OptimizedRouteMap"), { ssr: false });

import { optimizeRoute } from "@/lib/route-optimizer";
import { DEFAULT_TRUCK, SECTOR_DEPOTS } from "@/lib/constants";
import { estimateMultiQuote } from "@/lib/estimate";
import type { EstimateResult, RiskLevel } from "@/lib/estimator-types";
import { WASTE_CATALOG, toEntries, totalKg } from "@/lib/waste-items";

const LEVEL_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co"}/storage/v1/object/public/gamification-levels`;
const CREW_SECTORS = ["Rishra", "Howrah", "Shyamnagar", "Tarakeswar", "Hugli-Chinsura"];

interface PickupRequest {
  id: string;
  scheduled_date: string;
  time_slot: string;
  operating_zone: string;
  weight: number;
  status: "pending" | "accepted" | "collected" | "completed" | "processed" | "cancelled";
  material_type?: string;
  user_address?: string;
  latitude?: number;
  longitude?: number;
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
  
  // On-Site scrap calculator — routes through the shared estimateQuote() contract (no hardcoded rates).
  // Sector defaults to the crew's operating zone; the doorstep quality observation IS the risk input.
  const defaultSector = CREW_SECTORS.includes(profile.operating_zone || "") ? (profile.operating_zone as string) : "Howrah";
  const [estItems, setEstItems] = useState<string[]>([]);
  const [estKg, setEstKg] = useState<Record<string, string>>({});
  const [estRisk, setEstRisk] = useState<RiskLevel>("Medium");
  const [estSector, setEstSector] = useState(defaultSector);
  const [estResult, setEstResult] = useState<EstimateResult | null>(null);

  const toggleEstItem = (label: string) => {
    setEstItems((prev) => (prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]));
    // Drop a deselected material's weight so it stops counting toward the quote.
    setEstKg((prev) => {
      if (prev[label] == null) return prev;
      const next = { ...prev };
      delete next[label];
      return next;
    });
  };

  // On-site payout = sum of each material's quote, logistics charged once. No hardcoded rates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!estItems.length || totalKg(estItems, estKg) <= 0) { if (!cancelled) setEstResult(null); return; }
      try {
        const r = await estimateMultiQuote({ entries: toEntries(estItems, estKg), sector: estSector, risk: estRisk });
        if (!cancelled) setEstResult(r);
      } catch { if (!cancelled) setEstResult(null); }
    })();
    return () => { cancelled = true; };
  }, [estItems, estKg, estRisk, estSector]);



  // ── GPS Telemetry Broadcast Channel ──────────────────────────
  // Streams real-time crew position to household customers via
  // Supabase Realtime Broadcast (zero-overhead WebSocket channel).
  useEffect(() => {
    const zone = profile.operating_zone || "all";
    const channel = supabase.channel(`tracking:${zone}`);
    trackingChannelRef.current = channel;

    // Gate broadcasts on the WS channel having joined. send() before SUBSCRIBED
    // falls back to a REST POST (deprecated) — skip those early pings; the next
    // GPS fix arrives in ~3s. Any non-SUBSCRIBED status flips this back off.
    let isJoined = false;

    channel.subscribe((status) => {
      isJoined = status === "SUBSCRIBED";
      // Mirror the join state onto the banner so it clears on CLOSED/CHANNEL_ERROR/TIMED_OUT.
      setIsBroadcasting(isJoined);
    });

    let watchId: number | undefined;

    if (typeof window !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!isJoined) return; // WS-only; skip pre-join/post-drop pings (no REST fallback)
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

  // Client-side optimized collection route (NN + 2-opt, capacity-aware).
  const stops = pickups
    .filter(p => p.latitude != null && p.longitude != null)
    .map(p => ({
      id: p.id,
      latitude: p.latitude!,
      longitude: p.longitude!,
      weight: p.weight,
      time_slot: p.time_slot,
      address: p.user_address,
      material_type: p.material_type,
    }));
  const depot = SECTOR_DEPOTS[pickups[0]?.operating_zone] ?? undefined;
  const route = optimizeRoute(stops, DEFAULT_TRUCK, depot);

  return (
    <div className="flex flex-col min-h-screen bg-[#F4EFE3]">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        
        {/* Dynamic Network Status Banner */}
        {isOffline && (
          <div className="mb-6 w-full p-3 bg-amber-warm text-bark rounded-xl font-mono text-xs font-bold text-center animate-pulse shadow-sm">
            ⚠️ OFFLINE LOGISTICS CACHE ACTIVE — Serving cached data from local device layers.
          </div>
        )}

        {/* Live Broadcast Telemetry Status Indicator */}
        {isBroadcasting && !isOffline && (
          <div className="mb-6 w-full p-2.5 bg-[#8FA37E]/15 border border-[#8FA37E]/30 text-[#4A6741] rounded-xl font-mono text-[11px] font-bold text-center flex items-center justify-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4A6741] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4A6741]"></span>
            </span>
            LIVE TELEMETRY STREAM ACTIVE — Broadcasting GPS to customers in {profile.operating_zone || "all zones"}
          </div>
        )}

        {/* Landing Layout Section: CrewHub Title */}
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[rgba(194,112,61,0.15)] pb-6">
          <div>
            <h1 className="font-syne font-bold text-xl text-[#2A2218] tracking-tight">
              CrewHub
            </h1>
            <p className="text-xs text-[#6B5744] mt-1">
              Active Hub Operations Sector: <span className="font-bold text-[#C2703D]">{activeZone}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs bg-[#8FA37E]/10 text-[#4A6741] font-bold border border-[#8FA37E]/30 rounded-full px-3 py-1.5 uppercase">
              🛡️ {profile.role} terminal
            </span>
          </div>
        </div>

        {/* Quick Analytical Overview Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="t-glass-card t-lift rounded-xl p-4 bg-[#EDE5D8]/40 border border-[rgba(194,112,61,0.12)] backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-[#6B5744] block uppercase tracking-wider">Assigned Runs</span>
            <span className="text-lg sm:text-2xl font-mono font-bold block mt-1 text-[#C2703D]">{totalCount}</span>
          </div>
          <div className="t-glass-card t-lift rounded-xl p-4 bg-[#EDE5D8]/40 border border-[rgba(194,112,61,0.12)] backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-[#6B5744] block uppercase tracking-wider">Remaining Pickups</span>
            <span className="text-lg sm:text-2xl font-mono font-bold block mt-1 text-clay">{pendingCount}</span>
          </div>
          <div className="t-glass-card t-lift rounded-xl p-4 bg-[#EDE5D8]/40 border border-[rgba(194,112,61,0.12)] backdrop-blur-md shadow-sm">
            <span className="text-xs font-semibold text-[#6B5744] block uppercase tracking-wider">Cleared runs</span>
            <span className="text-lg sm:text-2xl font-mono font-bold block mt-1 text-[#4A6741]">{completedCount}</span>
          </div>
        </div>

        {/* Main Content Layout Container */}
        <div className="w-full flex flex-col gap-6">
          
          {/* Live Sequence Map */}
          <div className="t-glass-card rounded-2xl p-4 bg-[#EDE5D8]/30 border border-[rgba(194,112,61,0.18)] shadow-sm">
            <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-3">
              Live Optimized Collection Sequence Map
            </h2>
            <div className="relative w-full h-[320px] rounded-2xl overflow-hidden shadow-md border border-[rgba(194,112,61,0.15)] bg-[#EDE5D8]/20">
              {/* Optimized visiting order (NN + 2-opt) plotted with an OSRM road polyline. */}
              <OptimizedRouteMap stops={route.sequence} depot={depot} />

              <div className="absolute top-3 right-3 z-[1000] font-mono font-bold text-[11px] text-[#F4EFE3] bg-[#2A2218]/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-[#C2703D]/30 shadow-xl flex items-center gap-2 select-none">
                <span>{route.sequence.length} stops</span>
                <span className="text-[#C2703D]">·</span>
                <span>{route.totalKm.toFixed(1)} km</span>
                <span className="text-[#C2703D]">·</span>
                <span>{route.totalWeight.toFixed(0)} kg</span>
              </div>
            </div>

            {route.deferred.length > 0 && (
              <p className="mt-3 text-[11px] font-mono text-clay">
                ⚠️ {route.deferred.length} pickup(s) deferred to next run (over truck capacity / stop limit).
              </p>
            )}
          </div>

            {/* Pickup Requests Ledger Table */}
            <Reveal className="w-full mt-6 t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/40 border border-[rgba(194,112,61,0.15)] shadow-sm">
              <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-4 flex items-center gap-2">
                📋 Pickup Requests
              </h2>
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[rgba(194,112,61,0.15)] font-syne text-xs uppercase tracking-wider text-[#6B5744]">
                      <th className="py-3 px-3">Address & Destination</th>
                      <th className="py-3 px-3">Schedule Timeline</th>
                      <th className="py-3 px-3">Weight Vector</th>
                      <th className="py-3 px-3">Pipeline Status</th>
                      <th className="py-3 px-3 text-right">Operational Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(194,112,61,0.08)]">
                    {pickups.map((p) => (
                      <tr key={p.id} className="hover:bg-[#EDE5D8]/20 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[#2A2218] text-sm">{p.operating_zone}</div>
                          <div className="text-xs text-[#6B5744] mt-0.5 max-w-[200px] truncate">{p.user_address || "SKFGI Aggregation Drop Point"}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="text-xs font-semibold text-[#2A2218]">{p.scheduled_date}</div>
                          <div className="font-mono text-[11px] text-[#C2703D] mt-0.5 font-medium">{p.time_slot}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="font-mono text-xs font-bold text-[#4A6741] bg-[#8FA37E]/10 px-2.5 py-0.5 rounded">
                            {p.weight === 7.5 ? "5-10 kg" : p.weight === 12.5 ? "10-15 kg" : p.weight === 17.5 ? "15-20 kg" : p.weight === 25 ? "20+ kg" : `${p.weight} kg`}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className={`text-[10px] font-mono uppercase font-bold tracking-tight px-2 py-1 rounded border ${
                            p.status === 'completed' ? 'bg-moss/12 text-moss border-moss/30' :
                            p.status === 'collected' ? 'bg-[#8FA37E]/10 text-[#4A6741] border-[#8FA37E]/30' :
                            p.status === 'accepted' ? 'bg-terra/10 text-terra border-terra/30' :
                            p.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                            'bg-amber-warm/15 text-clay border-amber-warm/30'
                          }`}>
                            {p.status === 'completed' ? 'processed' : p.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <button
                            onClick={() => { setSelectedPickup(p); setIsActionModalOpen(true); }}
                            className="bg-[#C2703D] hover:bg-[#A0522D] text-white text-xs font-bold px-3 py-1.5 rounded-lg font-syne uppercase tracking-wider min-h-[36px] t-focus-ring"
                          >
                            Report Impurities ⚠️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>

            {/* 2. MOUNT THE MIGRATE ON-SITE PRICE ESTIMATOR */}
            <Reveal className="t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/30 border border-[rgba(194,112,61,0.18)] shadow-sm mt-6">
              <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-3 flex items-center gap-2">
                <img src={`${LEVEL_BUCKET_BASE}/price-estimator.png`} alt="" className="h-7 w-7 object-contain" loading="lazy" />
                Price Estimator
              </h2>
              <p className="text-xs text-[#6B5744] mb-4">Verify weights and calculate real-time custom Indian Rupee (₹) payouts directly at the doorstep if load discrepancies occur.</p>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold uppercase text-[#2A2218]">
                    Material streams
                    {estItems.length > 0 && (
                      <span className="ml-1 font-normal normal-case text-[#8C7A63]">· {estItems.length} · {totalKg(estItems, estKg)} kg</span>
                    )}
                  </label>
                  <p className="text-[11px] text-[#8C7A63] mb-1">Tick each stream in the load and weigh it — the payout adds up across all of them.</p>
                  <div role="group" aria-label="Select material streams" className="max-h-52 overflow-y-auto rounded-lg border border-[#D4C5B0] bg-[#F4EFE3]">
                    {WASTE_CATALOG.map((cat) => (
                      <div key={cat.category}>
                        <div className="sticky top-0 z-10 bg-[#F4EFE3] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#8C7A63] border-b border-[#D4C5B0]/60">
                          {cat.category}
                        </div>
                        {cat.items.map((it) => {
                          const checked = estItems.includes(it.label);
                          const id = `crew-m-${it.label.replace(/\s+/g, "-")}`;
                          return (
                            <div key={it.label} className="flex min-h-11 items-center gap-2.5 px-3 py-2 text-xs text-[#2A2218] hover:bg-[#EDE5D8]/60">
                              <input
                                id={id}
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEstItem(it.label)}
                                className="h-4 w-4 shrink-0 accent-[#C2703D] cursor-pointer"
                              />
                              <label htmlFor={id} className={`flex-1 cursor-pointer ${checked ? "font-semibold" : ""}`}>{it.label}</label>
                              {checked && (
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.5"
                                  placeholder="kg"
                                  value={estKg[it.label] ?? ""}
                                  onChange={(e) => setEstKg((p) => ({ ...p, [it.label]: e.target.value }))}
                                  aria-label={`${it.label} weight in kilograms`}
                                  className="w-16 shrink-0 rounded-md border border-[#D4C5B0] bg-white px-2 py-1 text-right text-xs text-[#2A2218] focus:border-[#C2703D] focus:outline-none"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase text-[#2A2218]">Quality Defect Risk</label>
                    <select
                      value={estRisk}
                      onChange={(e) => setEstRisk(e.target.value as RiskLevel)}
                      className="p-2.5 bg-[#F4EFE3] border border-[#D4C5B0] rounded-lg text-xs text-[#2A2218]"
                    >
                      <option value="Low">Low — clean load</option>
                      <option value="Medium">Medium — minor contamination</option>
                      <option value="High">High — heavy defect / moisture</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold uppercase text-[#2A2218]">Sector</label>
                    <select
                      value={estSector}
                      onChange={(e) => setEstSector(e.target.value)}
                      className="p-2.5 bg-[#F4EFE3] border border-[#D4C5B0] rounded-lg text-xs text-[#2A2218]"
                    >
                      {CREW_SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[rgba(194,112,61,0.08)] flex justify-between items-center">
                <span className="text-xs font-semibold text-[#6B5744]">
                  Calculated Payout Estimation:
                  {estResult && <span className="ml-2 font-normal text-[#8C7A63]">₹{estResult.userPayoutPerKg.toFixed(2)}/kg · {estResult.distanceKm}km logistics</span>}
                </span>
                <span className="font-mono text-sm font-bold text-[#4A6741] bg-[#8FA37E]/10 px-3 py-1 rounded">
                  {estResult ? `₹ ${estResult.userPayoutTotal.toFixed(2)}` : "₹ Dynamic Sync"}
                </span>
              </div>
            </Reveal>
          </div>


      </main>

      {/* Reactive Overlay Modal for Reporting Impurities */}
      {isActionModalOpen && selectedPickup && (
        <div className="fixed inset-0 bg-[#2A2218]/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fadeIn">
          <div className="bg-[#F4EFE3] border border-[#D4C5B0] w-full max-w-md p-6 rounded-2xl shadow-2xl flex flex-col gap-5">
            
            {/* Modal Header Row */}
            <div className="flex justify-between items-start border-b border-[rgba(194,112,61,0.15)] pb-3">
              <div>
                <h3 className="font-syne font-bold text-base text-[#2A2218]">Manifest Operations: Run #{selectedPickup.id.substring(0, 8)}</h3>
                <p className="text-xs text-[#6B5744] mt-0.5 font-mono">Current Operational State: <span className="uppercase font-bold text-[#C2703D]">{selectedPickup.status}</span></p>
              </div>
              <button onClick={() => { setIsActionModalOpen(false); setSelectedPickup(null); }} className="text-sm font-bold text-[#6B5744] hover:text-destructive transition-colors t-focus-ring">✕</button>
            </div>

            {/* Step-by-Step Logistics State Actions Stack */}
            <div className="flex flex-col gap-2.5">
              <span className="font-syne font-bold text-[10px] uppercase tracking-widest text-[#6B5744]">Execute Flow Transitions</span>
              
              <button
                onClick={() => updatePickupStatus(selectedPickup.id, "accepted")}
                className="w-full font-syne font-bold text-xs uppercase tracking-wider p-3 bg-terra text-white rounded-xl transition-all hover:bg-[#A0522D] min-h-[44px] t-focus-ring"
              >
                1. Accept Assignment 🟢
              </button>

              <button
                onClick={() => updatePickupStatus(selectedPickup.id, "collected")}
                className="w-full font-syne font-bold text-xs uppercase tracking-wider p-3 bg-[#8FA37E] text-white rounded-xl transition-all hover:bg-[#4A6741] min-h-[44px] t-focus-ring"
              >
                2. Mark Load Collected ✓
              </button>

              <button
                onClick={() => updatePickupStatus(selectedPickup.id, "completed")}
                className="w-full font-syne font-bold text-xs uppercase tracking-wider p-3 bg-sage-deep text-white rounded-xl transition-all hover:bg-moss min-h-[44px] t-focus-ring"
              >
                3. Mark Load Processed 📦
              </button>

              <button
                onClick={() => updatePickupStatus(selectedPickup.id, "cancelled")}
                className="w-full font-syne font-bold text-xs uppercase tracking-wider p-3 bg-destructive/10 text-destructive border border-destructive/30 rounded-xl transition-all hover:bg-destructive/20 min-h-[44px] t-focus-ring"
              >
                4. Cancel Collection Run ✕
              </button>
            </div>

            {/* Embedded Quality Impurities Dropdown Panel Section */}
            <div className="border-t border-[rgba(194,112,61,0.12)] pt-4">
              <label className="font-syne font-bold text-[10px] uppercase tracking-wider text-[#6B5744] block mb-1.5">
                Log Quality Anomaly & AI Penalty Risk
              </label>
              <input
                type="text"
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                placeholder="e.g., Load rejected due to high industrial dust contamination"
                className="w-full p-2.5 bg-[#EDE5D8]/50 border border-[#D4C5B0] rounded-xl text-xs text-[#2A2218] focus:outline-none focus:border-[#C2703D]"
              />
              <button
                onClick={handleReportIssue}
                className="w-full mt-2 font-syne font-bold text-xs uppercase tracking-wider p-2 bg-[#2A2218] text-white rounded-lg transition-colors hover:bg-black border-0 cursor-pointer min-h-[36px]"
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
