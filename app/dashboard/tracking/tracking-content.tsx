"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

// Lazy-load Leaflet map to avoid SSR hydration issues
const TrackingMap = dynamic(() => import("./tracking-map"), { ssr: false });

interface TrackingContentProps {
  userProfile: {
    id: string;
    full_name: string;
    role: string;
    operating_zone: string;
  };
}

export default function TrackingContent({ userProfile }: TrackingContentProps) {
  const supabase = createClient();
  const [crewLocation, setCrewLocation] = useState<[number, number] | null>(null);
  const [interpolatedCoords, setInterpolatedCoords] = useState<[number, number] | null>(null);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastPingTime, setLastPingTime] = useState<string | null>(null);
  const [crewSpeed, setCrewSpeed] = useState<number>(0);
  const [crewHeading, setCrewHeading] = useState<number>(0);

  // User's home location based on their operating zone
  const ZONE_HOME_COORDINATES: Record<string, [number, number]> = {
    Rishra: [22.7102, 88.3204],
    Howrah: [22.5958, 88.2636],
    Shyamnagar: [22.8271, 88.3768],
    Tarakeswar: [22.8872, 88.0163],
    "Hugli-Chinsura": [22.9079, 88.3912],
  };
  const userHome = ZONE_HOME_COORDINATES[userProfile.operating_zone] || [22.7102, 88.3204];

  // ── 1. Subscribe to the matching regional tracking channel ──
  useEffect(() => {
    const zone = userProfile.operating_zone || "all";
    const channel = supabase.channel(`tracking:${zone}`);

    channel
      .on("broadcast", { event: "telemetry_ping" }, (message) => {
        const payload = message.payload;
        if (payload?.coords) {
          setCrewLocation(payload.coords as [number, number]);
          setCrewSpeed(payload.speed || 0);
          setCrewHeading(payload.heading || 0);
          setLastPingTime(payload.timestamp || new Date().toISOString());
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [userProfile.operating_zone, supabase]);

  // ── 2. LERP Smoothing Animation Frame Engine ──
  useEffect(() => {
    let animFrameId: number;
    const smoothGlide = () => {
      if (crewLocation) {
        setInterpolatedCoords((prev) => {
          if (!prev) return crewLocation;
          const latDelta = (crewLocation[0] - prev[0]) * 0.08;
          const lngDelta = (crewLocation[1] - prev[1]) * 0.08;
          if (Math.abs(latDelta) < 0.00001 && Math.abs(lngDelta) < 0.00001) return crewLocation;
          return [prev[0] + latDelta, prev[1] + lngDelta];
        });
      }
      animFrameId = requestAnimationFrame(smoothGlide);
    };
    animFrameId = requestAnimationFrame(smoothGlide);
    return () => cancelAnimationFrame(animFrameId);
  }, [crewLocation]);

  // ── 3. Haversine Distance + ETA Compute ──
  useEffect(() => {
    if (!interpolatedCoords) return;
    const R = 6371; // Earth radius in KM
    const dLat = ((userHome[0] - interpolatedCoords[0]) * Math.PI) / 180;
    const dLng = ((userHome[1] - interpolatedCoords[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((interpolatedCoords[0] * Math.PI) / 180) *
        Math.cos((userHome[0] * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    // ETA using average speed of 22 km/h with a traffic congestion factor of 1.35
    const minutes = (distance / 22) * 60 * 1.35;
    setEstimatedMinutes(Math.max(1, Math.round(minutes)));
  }, [interpolatedCoords, userHome]);

  // Format the last ping timestamp to a readable string
  const formatPingTime = (iso: string | null) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return "—";
    }
  };

  // Compass direction from heading degrees
  const getCompassDir = (deg: number) => {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(deg / 45) % 8];
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F4EFE3]">
      <Navbar />

      <main className="flex-1 w-full">
        {/* Full-bleed map viewport */}
        <div className="relative w-full" style={{ height: "calc(100vh - 72px)" }}>
          {/* Leaflet Map Canvas */}
          <TrackingMap
            interpolatedCoords={interpolatedCoords}
            userHome={userHome}
            userZone={userProfile.operating_zone}
          />

          {/* ── Top-right Connection Status Chip ── */}
          <div className="absolute top-4 right-4 z-[1000]">
            <div
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-mono text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md shadow-lg transition-all duration-500 ${
                isConnected
                  ? "bg-[#EDE5D8]/90 border-[#8FA37E]/40 text-[#4A6741]"
                  : "bg-[#EDE5D8]/90 border-amber-warm/40 text-clay"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isConnected ? "animate-ping bg-[#4A6741]" : "bg-amber-warm"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isConnected ? "bg-[#4A6741]" : "bg-amber-warm"
                  }`}
                />
              </span>
              {isConnected ? "Live Channel Active" : "Awaiting Signal…"}
            </div>
          </div>

          {/* ── Bottom-left ETA & Dispatch Status Card (Glassmorphism) ── */}
          {crewLocation && (
            <div className="absolute bottom-6 left-6 z-[1000] max-w-sm animate-fade-up" style={{ animationTimingFunction: "var(--ease-botanical)" }}>
              <div className="rounded-2xl p-5 bg-[#EDE5D8]/90 backdrop-blur-md border border-[#C2703D]/30 shadow-2xl">
                {/* Header row with truck icon & status */}
                <div className="flex items-start gap-4">
                  {/* Animated Truck Icon */}
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#8FA37E]/15 border border-[#8FA37E]/30 flex items-center justify-center text-2xl">
                    🚛
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="font-syne font-bold text-[10px] uppercase tracking-wider text-[#8FA37E] flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8FA37E] opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#8FA37E]" />
                      </span>
                      Trashium Dispatch Active
                    </span>
                    <h3 className="font-syne font-bold text-xl text-[#2A2218] mt-1 leading-tight">
                      Arriving in {estimatedMinutes ?? "—"} Mins
                    </h3>
                    <p className="text-[11px] text-[#6B5744] font-mono mt-1 truncate">
                      Sector: {userProfile.operating_zone}
                    </p>
                  </div>
                </div>

                {/* Telemetry Metrics Row */}
                <div className="mt-4 pt-3 border-t border-[#C2703D]/15 grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <span className="block font-mono text-[10px] text-[#6B5744] uppercase tracking-wider">
                      Speed
                    </span>
                    <span className="block font-mono text-sm font-bold text-[#2A2218] mt-0.5">
                      {(crewSpeed * 3.6).toFixed(0)} km/h
                    </span>
                  </div>
                  <div className="text-center border-x border-[#C2703D]/10">
                    <span className="block font-mono text-[10px] text-[#6B5744] uppercase tracking-wider">
                      Heading
                    </span>
                    <span className="block font-mono text-sm font-bold text-[#2A2218] mt-0.5">
                      {getCompassDir(crewHeading)} {Math.round(crewHeading)}°
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="block font-mono text-[10px] text-[#6B5744] uppercase tracking-wider">
                      Last Ping
                    </span>
                    <span className="block font-mono text-sm font-bold text-[#2A2218] mt-0.5">
                      {formatPingTime(lastPingTime)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Waiting State (no crew location yet) ── */}
          {!crewLocation && isConnected && (
            <div className="absolute inset-0 flex items-center justify-center z-[999] pointer-events-none">
              <div className="bg-[#EDE5D8]/95 backdrop-blur-md border border-[#C2703D]/20 rounded-2xl p-8 shadow-2xl text-center max-w-xs animate-fade-up pointer-events-auto" style={{ animationTimingFunction: "var(--ease-botanical)" }}>
                <div className="text-4xl mb-3">📡</div>
                <h3 className="font-syne font-bold text-base text-[#2A2218]">
                  Awaiting Crew Telemetry
                </h3>
                <p className="text-xs text-[#6B5744] mt-2 leading-relaxed">
                  Your collection crew hasn&apos;t started broadcasting yet. The
                  live tracker will activate automatically once the driver begins
                  their route in the <span className="font-bold text-[#C2703D]">{userProfile.operating_zone}</span> sector.
                </p>
                <div className="mt-4 flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C2703D] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C2703D] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C2703D] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
