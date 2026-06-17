"use client";

import React, { useState, useEffect } from "react";
import { Lock, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OPERATIONAL_SECTORS } from "@/lib/constants";
import { getTier, getLevelNumber, getTierIconFilename } from "@/lib/gamification";
import type { User } from "@supabase/supabase-js";
import type { ResolvedBadge } from "@/lib/types";
import type { ProfileWithZone } from "./page";

interface ProfileContentProps {
  profile: ProfileWithZone;
  user: User;
  badges: ResolvedBadge[];
}

const BADGE_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co"}/storage/v1/object/public/gamification-badges`;

export default function ProfileContent({ profile, user, badges }: ProfileContentProps) {
  const supabase = createClient();
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);

  // Map incoming props to user's internal structure
  const userAuth = { id: user.id, email: user.email ?? "" };
  const initialProfile = {
    full_name: profile.full_name,
    operating_zone: profile.operating_zone ?? "",
    green_credits: profile.green_credits,
    role: profile.role
  };
  const initialPhone = user.user_metadata?.phone || user.phone || "";

  // Form states matching field rows
  const [fullName, setFullName] = useState(initialProfile.full_name);
  const [phone, setPhone] = useState(initialPhone);
  const [zone, setZone] = useState(initialProfile.operating_zone);

  // Animated Points Counter State Engine
  const [displayedCredits, setDisplayedCredits] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = initialProfile.green_credits;
    if (end === 0) return;
    
    const duration = 1200; // Count-up time in milliseconds
    const increment = Math.ceil(end / (duration / 16));
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayedCredits(end);
        clearInterval(timer);
      } else {
        setDisplayedCredits(start);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [initialProfile.green_credits]);

  // Gamification milestone calculation engine (Level caps out at 1000 points)
  const currentPoints = initialProfile.green_credits;
  const pointsToNextLevel = 1000 - (currentPoints % 1000);
  const levelProgressPercentage = ((currentPoints % 1000) / 1000) * 100;
  
  // Mathematically synchronized circular geometry constants (Radius = 40)
  const circumference = 251.2;
  const strokeDashoffset = circumference - (circumference * levelProgressPercentage) / 100;

  // Tier label/avatar sourced from the canonical 20-tier system (lib/gamification.ts).
  const tierData = getTier(currentPoints);
  const levelNumber = getLevelNumber(currentPoints);
  const cdnLevelBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co"}/storage/v1/object/public/gamification-levels`;
  const tier = {
    label: `${tierData.rank} · Level ${levelNumber}`,
    style:
      levelNumber >= 16
        ? "text-emerald-700 bg-emerald-100 border-emerald-300"
        : levelNumber >= 7
        ? "text-[#4A6741] bg-[#7A9E7E]/20 border-[#7A9E7E]/40"
        : "text-amber-800 bg-amber-100 border-amber-300",
    iconUrl: `${cdnLevelBase}/${getTierIconFilename(tierData.rank)}`,
  };

  // Safely declared image load error boundary state hook
  const [imgError, setImgError] = useState(false);

  // Update the tier tracking effect:
  useEffect(() => {
    setImgError(false);
    console.log("📍 Trashium Target Level URL:", tier.iconUrl);
  }, [tier.iconUrl]);

  // Synchronized Mutation Handler Pipeline
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Commit Name and Zone modifications to the public database row
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ full_name: fullName, operating_zone: zone })
        .eq("id", userAuth.id);

      if (profileError) throw profileError;

      // 2. Safely sync the Phone field context inside the user authentication metadata scope
      const { error: authError } = await supabase.auth.updateUser({
        data: { phone: phone }
      });

      if (authError) throw authError;

      alert("✨ Profile details and contact metadata synchronized successfully.");
      setIsEditMode(false);
    } catch (err: any) {
      console.error("Profile transaction mismatch:", err);
      alert(`Sync Error: ${err.message || "Unable to save parameters."}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EFE6] text-[#2C1F14] font-dm p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      
      {/* Background decoration elements */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] select-none flex items-center justify-center">
        <span className="text-[40rem] font-bold font-syne">leaf</span>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 mt-4">
        
        {/* LEFT COLUMN: Gamified Leader Card Info Sheets */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="t-glass-card rounded-3xl p-6 bg-[#EDE5D8]/40 border border-[rgba(196,112,74,0.18)] backdrop-blur-md shadow-md flex flex-col items-center text-center">
            
            {/* SVG Progress Ring tracking surrounding user profile avatars */}
            <div className="relative w-24 h-24 flex items-center justify-center mb-4 mt-2">
              <svg className="absolute inset-0 transform -rotate-90 w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="rgba(196,112,74,0.1)" strokeWidth="6" fill="transparent" />
                <circle 
                  cx="50" cy="50" r="40" 
                  stroke="#7A9E7E" strokeWidth="6" fill="transparent" 
                  strokeDasharray={`${circumference}`}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              {/* Standard Tailwind Dimensions (w-16 h-16) to prevent element collapse bugs */}
              <div className="w-16 h-16 rounded-full bg-[#EDE5D8]/60 overflow-hidden border border-[#D4C5B0]/50 flex items-center justify-center p-2 shadow-inner relative z-10">
                {!imgError ? (
                  <img 
                    src={tier.iconUrl} 
                    alt={tier.label} 
                    className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(44,31,20,0.15)] animate-fadeIn relative z-10"
                    onLoad={() => console.log(`✅ Asset resolved successfully: ${tier.iconUrl}`)}
                    onError={() => {
                      console.error(`❌ Asset download rejected by network stream: ${tier.iconUrl}`);
                      setImgError(true);
                    }}
                  />
                ) : (
                  <div className="text-2xl animate-fadeIn select-none">🌱</div>
                )}
              </div>
            </div>

            <span className="font-syne font-bold text-lg text-[#2C1F14]">{fullName || "Citizen Ledger User"}</span>
            <span className="text-xs font-medium text-[#6B5744] uppercase tracking-widest mt-0.5">Role System: {initialProfile.role}</span>

            {/* Arboreal Evolution Tier Badge Asset wrapper */}
            <div className={`mt-4 px-3.5 py-1.5 rounded-xl border text-xs font-syne font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 ${tier.style}`}>
              {!imgError && (
                <img 
                  src={tier.iconUrl} 
                  className="w-4 h-4 object-contain" 
                  alt="" 
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                />
              )}
              {tier.label}
            </div>

            {/* High-Impact Credits Digital Counter Matrix ticker view */}
            <div className="w-full mt-6 pt-5 border-t border-[rgba(196,112,74,0.12)] flex flex-col items-center">
              <span className="text-xs uppercase font-bold text-[#6B5744] tracking-wider">Ecosystem Green Credits Balance</span>
              <span className="text-4xl font-mono font-bold text-[#4A6741] tracking-tight mt-1">
                {displayedCredits} <span className="text-xs font-dm font-normal text-[#6B5744]">pts</span>
              </span>
              <p className="text-[11px] text-[#6B5744] mt-2 font-mono italic text-center">
                ✨ Earn {pointsToNextLevel} more credits to trigger next eco tier checkpoint.
              </p>
            </div>
          </div>

          {/* Environmental Impact Statistics Summary Cards */}
          <div className="t-glass-card rounded-2xl p-5 bg-[#EDE5D8]/20 border border-[rgba(196,112,74,0.12)] flex flex-col gap-4">
            <span className="font-syne font-bold text-xs uppercase text-[#2C1F14] tracking-wider border-b border-[rgba(196,112,74,0.08)] pb-2">🎯 Ecological Performance Matrix</span>
            {[
              { text: "Estimated CO₂ Footprint Saved", val: `${(currentPoints * 0.42).toFixed(1)} kg`, icon: "🌍" },
              { text: "Aggregated Scrap Sorted", val: `${(currentPoints * 0.1).toFixed(0)} kg`, icon: "📦" }
            ].map((stat, idx) => (
              <div key={idx} className="flex justify-between items-center bg-[#F4EFE6]/60 p-3 rounded-xl border border-[#D4C5B0]/30">
                <span className="text-xs text-[#6B5744] font-medium flex items-center gap-1.5"><span>{stat.icon}</span>{stat.text}</span>
                <span className="font-mono text-xs font-bold text-[#2C1F14]">{stat.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Form Sheet Fields Node */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSaveProfile} className="t-glass-card rounded-3xl p-6 sm:p-8 bg-[#EDE5D8]/30 border border-[rgba(196,112,74,0.15)] backdrop-blur-md shadow-sm flex flex-col gap-6">
            <div className="flex justify-between items-center border-b border-[rgba(196,112,74,0.12)] pb-4">
              <div>
                <h2 className="font-syne font-bold text-lg text-[#2C1F14]">Account Specifications</h2>
                <p className="text-xs text-[#6B5744] mt-0.5">Manage identity fields and regional routing assignments safely.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditMode(!isEditMode)}
                className={`font-syne font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl border transition-all ${
                  isEditMode 
                    ? "bg-[#2C1F14] text-white border-black" 
                    : "bg-[#F4EFE6] text-[#2C1F14] border-[#D4C5B0] hover:bg-[#EDE5D8]"
                }`}
              >
                {isEditMode ? "Cancel Mode ✕" : "Edit Profile 📝"}
              </button>
            </div>

            {/* Input fields grid block spacing elements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase text-[#2C1F14] tracking-wider">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={!isEditMode}
                  className="w-full p-3 bg-[#F4EFE6] border border-[#D4C5B0] rounded-xl text-xs text-[#2C1F14] focus:outline-none focus:border-[#C4704A] transition-colors disabled:opacity-60"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase text-[#2C1F14] tracking-wider">Registered Authentication Email</label>
                <input
                  type="email"
                  value={userAuth.email}
                  disabled
                  className="w-full p-3 bg-[#F4EFE6]/50 border border-[#D4C5B0]/40 rounded-xl text-xs text-neutral-500 cursor-not-allowed select-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase text-[#2C1F14] tracking-wider">Primary Mobile Vector (Auth Metadata)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!isEditMode}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full p-3 bg-[#F4EFE6] border border-[#D4C5B0] rounded-xl text-xs text-[#2C1F14] focus:outline-none focus:border-[#C4704A] transition-colors disabled:opacity-60"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase text-[#2C1F14] tracking-wider">Default Operational Sector Hub</label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  disabled={!isEditMode}
                  className="w-full p-3 bg-[#F4EFE6] border border-[#D4C5B0] rounded-xl text-xs text-[#2C1F14] focus:outline-none focus:border-[#C4704A] transition-colors disabled:opacity-60 appearance-none"
                >
                  {OPERATIONAL_SECTORS.map((sectorName) => (
                    <option key={sectorName} value={sectorName}>
                      {sectorName} Regional Node
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Tactile saving actions drawer panel element */}
            {isEditMode && (
              <div className="mt-4 pt-4 border-t border-[rgba(196,112,74,0.08)] flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="min-h-[44px] bg-[#C4704A] hover:bg-[#A0522D] text-white font-syne font-bold text-xs uppercase tracking-wider rounded-xl shadow-md px-6 py-2.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Synchronizing Meta Vector..." : "Commit Changes Safe ✓"}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Ecosystem Checkpoints Badges Panel */}
        <div className="t-glass-card rounded-3xl p-6 bg-[#EDE5D8]/30 border border-[rgba(196,112,74,0.15)] backdrop-blur-md shadow-sm col-span-1 lg:col-span-12 mt-8 animate-fadeIn">
          <div>
            <span className="font-syne font-bold text-xs uppercase tracking-widest text-[#7A9E7E] block mb-1">Ecosystem Checkpoints</span>
            <h2 className="font-syne font-bold text-xl text-[#2C1F14] tracking-tight">🏆 Environmental Achievements & Badge Log</h2>
            <p className="text-xs text-[#6B5744] mt-0.5 mb-6">Track your environmental benchmarks and unlocked milestone badges.</p>
          </div>
          {badges.length === 0 ? (
            <p className="font-dm text-xs text-[#6B5744] py-8 text-center">Badges are unavailable right now — please refresh in a moment.</p>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {badges.map((badge) => {
              const earned = badge.state === "earned";
              const inProgress = badge.state === "in-progress";
              const hasTarget = Number.isFinite(badge.target);
              const remaining = hasTarget ? Math.max(0, badge.target - badge.current) : null;
              const cardStyle = earned
                ? "bg-[#EDE5D8]/50 border-[#7A9E7E]/40 shadow-sm"
                : inProgress
                ? "bg-[#EDE5D8]/30 border-[#C4704A]/25"
                : "bg-[#EDE5D8]/10 border-[#D4C5B0]/25";
              return (
                <div
                  key={badge.id}
                  tabIndex={0}
                  aria-label={`${badge.title} — ${earned ? "earned" : inProgress ? `${badge.pct}% complete` : "locked"}`}
                  className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center text-center relative group min-h-[160px] outline-none focus-visible:ring-2 focus-visible:ring-[#7A9E7E] ${cardStyle}`}
                >
                  <div className="relative mb-3">
                    {/* in-progress ring (conic-gradient, native CSS — no SVG math) */}
                    {inProgress && (
                      <div
                        className="absolute -inset-1 rounded-full"
                        style={{ background: `conic-gradient(#7A9E7E ${badge.pct}%, rgba(196,112,74,0.12) 0)` }}
                        aria-hidden
                      />
                    )}
                    <div className="w-14 h-14 rounded-full bg-[#F4EFE6]/90 p-2 flex items-center justify-center border border-[#D4C5B0]/40 relative">
                      {badge.image_filename ? (
                        <img
                          src={`${BADGE_BUCKET_BASE}/${badge.image_filename}`}
                          alt=""
                          className={`w-full h-full object-contain ${
                            earned
                              ? "filter drop-shadow-[0_2px_4px_rgba(74,103,65,0.15)]"
                              : inProgress
                              ? "opacity-90"
                              : "filter grayscale opacity-40"
                          }`}
                        />
                      ) : (
                        <span className={`font-syne font-bold text-lg ${earned ? "text-[#4A6741]" : "text-[#6B5744] opacity-50"}`}>
                          {badge.title.charAt(0)}
                        </span>
                      )}
                    </div>
                    {/* state marker — not color-only (icon distinguishes earned vs locked) */}
                    {earned && (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-[#4A6741] rounded-full p-0.5 border-2 border-[#F4EFE6]">
                        <Check className="w-3 h-3 text-[#F4EFE6]" strokeWidth={3} />
                      </span>
                    )}
                    {badge.state === "locked" && (
                      <span className="absolute -bottom-0.5 -right-0.5 bg-[#6B5744] rounded-full p-1 border-2 border-[#F4EFE6]">
                        <Lock className="w-2.5 h-2.5 text-[#F4EFE6]" />
                      </span>
                    )}
                  </div>
                  <span className="font-syne font-bold text-xs text-[#2C1F14] line-clamp-1">{badge.title}</span>
                  {inProgress && hasTarget && (
                    <span className="mt-1 font-mono text-[10px] text-[#6B5744]">
                      {badge.current.toLocaleString()} / {badge.target.toLocaleString()} · {remaining!.toLocaleString()} to go
                    </span>
                  )}
                  {earned && (
                    <span className="mt-1 font-syne text-[10px] font-bold uppercase tracking-wider text-[#4A6741]">Earned</span>
                  )}
                  {/* detail on hover / focus (tap focuses on mobile) */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2.5 bg-[#2C1F14] text-[#F4EFE6] text-[10px] rounded-xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 z-50 text-center font-dm border border-[#C4704A]/20">
                    <span className="font-syne font-bold block mb-1 uppercase tracking-wider text-[#7A9E7E]">
                      {earned ? "Earned" : inProgress ? `In progress · ${badge.pct}%` : "Locked"}
                    </span>
                    {badge.description}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-[#2C1F14]"></div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

      </div>
    </div>
  );
}
