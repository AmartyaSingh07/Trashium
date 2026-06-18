"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Lock, Check, ArrowRight, Recycle, HelpCircle, Truck, Gift, TrendingUp, Trophy, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ImpactCard from "@/components/dashboard/impact-card";
import EcoLevelBadge, { TRASHIUM_EVALUATION_TIERS, getTierIcon, getTierIconUrl } from "@/components/dashboard/eco-level-badge";
import SchedulePickupModal from "@/components/dashboard/schedule-pickup-modal";
import RecentPickups from "@/components/dashboard/recent-pickups";

import type { Profile, PickupRequest, ResolvedBadge, LeaderboardEntry } from "@/lib/types";
import { StreakCard } from "@/components/ui/streak-card";
import { AchievementBadge, AchievementCard, AchievementUnlocked, type UserAchievement } from 'ui.trophy';
import type { StreakPeriod } from "@/components/ui/streak-calendar";
import { LeaderboardCard } from "@/components/ui/leaderboard-card";
import { toast } from "sonner";

function getStreakPeriods(dates: string[]): StreakPeriod[] {
  if (dates.length === 0) return [];
  const periods: StreakPeriod[] = [];
  let start = dates[0];
  let end = dates[0];

  for (let i = 1; i < dates.length; i++) {
    const prevDate = new Date(dates[i - 1]);
    const currDate = new Date(dates[i]);
    const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      end = dates[i];
    } else {
      periods.push({ periodStart: start, periodEnd: end });
      start = dates[i];
      end = dates[i];
    }
  }
  periods.push({ periodStart: start, periodEnd: end });
  return periods;
}

interface DashboardContentProps {
  profile: Profile;
  initialPickups: PickupRequest[];
  badges: ResolvedBadge[];
  leaderboard: LeaderboardEntry[];
}

const OPERATIONAL_SECTORS = ['Rishra', 'Howrah', 'Shyamnagar', 'Tarakeswar', 'Hugli-Chinsura'];
const UNASSIGNED_SECTOR = 'Unassigned';

// RPC returns the raw pickup location (e.g. "Rishra, Kolkata"); fold it onto an operational sector.
// No completed pickup → null → "Unassigned" bucket.
const matchSector = (raw: string | null | undefined): string => {
  if (!raw) return UNASSIGNED_SECTOR;
  const hit = OPERATIONAL_SECTORS.find((s) => raw.toLowerCase().includes(s.toLowerCase()));
  return hit ?? UNASSIGNED_SECTOR;
};

// Eco-tier for a credit balance — reused for podium/row tree art and the level byline.
const tierForCredits = (credits: number) =>
  [...TRASHIUM_EVALUATION_TIERS].reverse().find((t) => credits >= t.minPoints) || TRASHIUM_EVALUATION_TIERS[0];
const BADGE_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co"}/storage/v1/object/public/gamification-badges`;

const normalizeSectorName = (zone: string) => {
  if (zone === 'Bally' || zone === 'Belur') return 'Howrah';
  return zone;
};

const normalizePickup = (p: any): PickupRequest => ({
  ...p,
  location: normalizeSectorName(p.location)
});

export default function DashboardContent({
  profile,
  initialPickups,
  badges,
  leaderboard,
}: DashboardContentProps) {
  const [pickups, setPickups] = useState<PickupRequest[]>(() => initialPickups.map(normalizePickup));
  const supabase = createClient();
  // Default the sector toggle to the signed-in household's own sector.
  const myLeaderboardRow = leaderboard.find((r) => r.user_id === profile.id);
  const [selectedSector, setSelectedSector] = useState(() => matchSector(myLeaderboardRow?.sector));

  // Core local states for credits & sorting verification
  const [greenCredits, setGreenCredits] = useState(profile?.green_credits ?? 0);
  const [isWasteSegregated, setIsWasteSegregated] = useState(false);

  // DYNAMIC PICKUP STREAK DETECTION (Task 1)
  const hasPickupToday = pickups.some(p => {
    const pickupDate = new Date(p.scheduled_date).toDateString();
    const todayDate = new Date().toDateString();
    return pickupDate === todayDate;
  });

  // WASTE SEGREGATION HANDLER PIPELINE (Task 2)
  const handleLogWasteSegregation = async () => {
    if (isWasteSegregated) return;
    setIsWasteSegregated(true);
    
    setGreenCredits(prev => {
      const nextCredits = prev + 2;
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          supabase
            .from("profiles")
            .update({ green_credits: nextCredits })
            .eq("id", user.id)
            .then(({ error }) => {
              if (error) console.error("Error updating credits in db:", error);
            });
        }
      });
      return nextCredits;
    });
  };

  // Trivia Quiz States
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizFeedbackText, setQuizFeedbackText] = useState("");
  const [quizzesCorrectToday, setQuizzesCorrectToday] = useState(0); // Progress tracker (Max 5 successful completions)
  const [quizStrikesUsed, setQuizStrikesUsed] = useState(0); // Lives tracker (Max 2 incorrect strikes allowed)

  // Achievements real-time unlocking states
  const [unlockedAchievement, setUnlockedAchievement] = useState<UserAchievement | null>(null);
  const [showUnlockToast, setShowUnlockToast] = useState(false);
  const [previouslyUnlockedIds, setPreviouslyUnlockedIds] = useState<string[]>(() => {
    const initialUnlocked: string[] = [];
    if (profile.pickups_completed >= 1) initialUnlocked.push("first-sorting");
    if (profile.kg_recycled >= 10) initialUnlocked.push("10kg-recycled");
    if (profile.green_credits >= 100) initialUnlocked.push("green-champion");
    return initialUnlocked;
  });

  // Load from localStorage on mount and check daily reset
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedDate = localStorage.getItem("quizDate");
      const today = new Date().toDateString();
      if (savedDate !== today) {
        localStorage.setItem("quizDate", today);
        localStorage.setItem("quizzesCorrectToday", "0");
        localStorage.setItem("quizStrikesUsed", "0");
      } else {
        const completed = localStorage.getItem("quizzesCorrectToday");
        const strikes = localStorage.getItem("quizStrikesUsed");
        if (completed) setQuizzesCorrectToday(parseInt(completed, 10));
        if (strikes) setQuizStrikesUsed(parseInt(strikes, 10));
      }
    }
  }, []);

  // Write to localStorage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      const today = new Date().toDateString();
      const savedDate = localStorage.getItem("quizDate");
      if (savedDate === today) {
        localStorage.setItem("quizzesCorrectToday", quizzesCorrectToday.toString());
      }
    }
  }, [quizzesCorrectToday]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const today = new Date().toDateString();
      const savedDate = localStorage.getItem("quizDate");
      if (savedDate === today) {
        localStorage.setItem("quizStrikesUsed", quizStrikesUsed.toString());
      }
    }
  }, [quizStrikesUsed]);

  const ecoTriviaPool = [
    { q: "Which type of waste plastic degrades slowest in landfills?", a: ["PET Bottles", "PVC Pipes", "Styrofoam Cups", "HDPE Jugs"], correct: 2 },
    { q: "What is the primary eco-benefit of source-segregating dry waste?", a: ["Saves logistical space", "Prevents cross-contamination", "Reduces total weight", "Increases landfill capacity"], correct: 1 },
    { q: "How long does a standard aluminum beverage can take to decompose naturally?", a: ["50 Years", "80-200 Years", "500 Years", "Never"], correct: 1 },
    { q: "What percentage of energy is saved by recycling paper vs making it raw?", a: ["15%", "40%", "60%", "90%"], correct: 2 }
  ];

  const handleLaunchQuiz = () => {
    if (quizStrikesUsed >= 2) {
      toast.error("Daily chances exhausted. You have committed 2 incorrect answers today.");
      return;
    }
    if (quizzesCorrectToday >= 5) {
      toast.success("Daily limit achieved! You have completed all 5 educational quizzes for today.");
      return;
    }
    const randomIndex = Math.floor(Math.random() * ecoTriviaPool.length);
    setCurrentQuestion(ecoTriviaPool[randomIndex]);
    setSelectedAnswer(null);
    setQuizSubmitted(false);
    setQuizFeedbackText("");
    setIsQuizOpen(true);
  };

  const handleSubmitQuiz = async () => {
    if (selectedAnswer === null) {
      toast.error("Please select an answer first");
      return;
    }
    setQuizSubmitted(true);

    if (selectedAnswer === currentQuestion.correct) {
      if (quizzesCorrectToday < 5) {
        setGreenCredits(prev => prev + 1);
        setQuizzesCorrectToday(prev => prev + 1);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Fix: previously wrote a non-existent `total_points` column. Credits live in green_credits.
          await supabase.from('profiles').update({ green_credits: greenCredits + 1 }).eq('id', user.id);
        }

        setQuizFeedbackText(`Correct! +1 Green Credit earned. Current progress: ${quizzesCorrectToday + 1}/5.`);
        toast.success(`Correct! +1 Green Credit earned. Current progress: ${quizzesCorrectToday + 1}/5.`);
      }
    } else {
      setQuizStrikesUsed(prev => {
        const newStrikes = prev + 1;
        if (newStrikes === 1) {
          setQuizFeedbackText("Incorrect answer. Strike 1/2 committed! Be careful on your final chance.");
          toast.warning("Incorrect answer. Strike 1/2 committed! Be careful on your final chance.");
        } else if (newStrikes === 2) {
          setQuizFeedbackText("Incorrect answer. Strike 2/2 committed. Your quiz engine is now locked until tomorrow.");
          toast.error("Incorrect answer. Strike 2/2 committed. Your quiz engine is now locked until tomorrow.");
        }
        return newStrikes;
      });
    }
  };

  // Live, households-only rankings for a sector, ranked by Green Credits (desc). Built from the
  // get_household_leaderboard RPC — real registered households only, no mocks, admin/crew excluded.
  const buildSectorRankings = (sector: string) => {
    const ranked = leaderboard
      .filter((r) => matchSector(r.sector) === sector)
      .map((r) => ({ ...r, credits: Number(r.green_credits) || 0 }))
      .sort((a, b) => b.credits - a.credits);

    const rankings = ranked.map((r, index) => {
      const tier = tierForCredits(r.credits);
      return {
        userId: r.user_id,
        userName: r.display_name,
        byline: `Lvl ${tier.level} · ${tier.rank}`,
        value: r.credits,
        avatarUrl: getTierIconUrl(tier.rank), // eco-tier tree art, by real credits
        rank: index + 1,
        displayed: true,
      };
    });

    return { rankings, podiumRankings: rankings.slice(0, 3) };
  };

  const { rankings: sectorRankings, podiumRankings: sectorPodium } = buildSectorRankings(selectedSector);

  // "N credits to overtake the household above you" — computed from the real sorted list.
  const myRank = sectorRankings.find((r) => r.userId === profile.id);
  const rivalAbove = myRank && myRank.rank > 1 ? sectorRankings[myRank.rank - 2] : null;
  const creditsToOvertake = rivalAbove ? Math.max(1, rivalAbove.value - (myRank?.value ?? 0) + 1) : 0;

  // Sector toggle options: operational sectors + an "All Sectors" bucket when any household has
  // no completed pickup yet (null sector from the RPC).
  const hasUnassigned = leaderboard.some((r) => matchSector(r.sector) === UNASSIGNED_SECTOR);
  const sectorRunOptions = [
    ...OPERATIONAL_SECTORS.map((s) => ({ id: s, label: `${s} Sector` })),
    ...(hasUnassigned ? [{ id: UNASSIGNED_SECTOR, label: "All Sectors" }] : []),
  ];
  const selectedSectorLabel =
    sectorRunOptions.find((o) => o.id === selectedSector)?.label ?? selectedSector;

  // ─── Client-side pickup fetcher ────────────────────────────────────
  const refreshPickups = useCallback(async () => {
    const { data } = await supabase
      .from("pickup_requests")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      setPickups(data.map(normalizePickup) as PickupRequest[]);
    }
  }, [supabase, profile.id]);

  // Fetch pickups on mount (ensures fresh data even if server cache is stale)
  useEffect(() => {
    refreshPickups();
  }, [refreshPickups]);

  // ─── Safe accessors (defensive even though server guarantees values) ──
  const credits = greenCredits;
  const kgRecycled = Number(profile?.kg_recycled ?? 0);
  const co2Saved = Number(profile?.co2_saved ?? 0);
  const fullName = profile?.full_name || "Eco Warrior";

  // ─── Level calculation using the new 20-tier matrix ─────────────────
  const currentPoints = greenCredits;
  const activeTier = [...TRASHIUM_EVALUATION_TIERS].reverse().find(t => currentPoints >= t.minPoints) || TRASHIUM_EVALUATION_TIERS[0];
  const nextTierIndex = TRASHIUM_EVALUATION_TIERS.findIndex(t => t.rank === activeTier.rank) + 1;
  const nextTier = nextTierIndex < TRASHIUM_EVALUATION_TIERS.length ? TRASHIUM_EVALUATION_TIERS[nextTierIndex] : null;
  const activeTierIcon = getTierIcon(activeTier.rank);
  const activeTierIconUrl = getTierIconUrl(activeTier.rank);

  // Compute completed pickup dates for streaks (only for household role)
  const isHousehold = profile?.role === "household";
  const todayStrLocal = new Date().toLocaleDateString();
  const hasDailyActionToday = hasPickupToday || isWasteSegregated || quizzesCorrectToday > 0;
  
  const completedDates = isHousehold
    ? Array.from(
        new Set([
          ...pickups
            .filter((p) => (p.status as string) === "completed" || (p.status as string) === "collected" || (p.status as string) === "processed")
            .map((p) => new Date(p.scheduled_date).toLocaleDateString()),
          ...(hasDailyActionToday ? [todayStrLocal] : [])
        ])
      ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    : [];

  const computedPeriods = getStreakPeriods(completedDates);

  let currentStreak = 0;
  let longestStreak = 0;

  if (completedDates.length > 0) {
    computedPeriods.forEach((p) => {
      const s = new Date(p.periodStart);
      const e = new Date(p.periodEnd);
      const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > longestStreak) {
        longestStreak = diff;
      }
    });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStrLocal = yesterday.toLocaleDateString();

    const lastPeriod = computedPeriods[computedPeriods.length - 1];
    if (lastPeriod.periodEnd === todayStrLocal || lastPeriod.periodEnd === yesterdayStrLocal) {
      const s = new Date(lastPeriod.periodStart);
      const e = new Date(lastPeriod.periodEnd);
      currentStreak = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  // Define achievements dynamically
  const achievements: UserAchievement[] = [
    {
      id: "first-sorting",
      name: "First Sorting Milestone",
      description: "Complete your first dry waste sorting & scheduled collection slot.",
      trigger: "metric",
      achievedAt: profile.pickups_completed >= 1 ? profile.created_at : null,
      progress: profile.pickups_completed >= 1 ? 100 : 0,
      rarity: 85,
    },
    {
      id: "10kg-recycled",
      name: "10kg Recycled Club",
      description: "Divert at least 10 kg of dry waste from local landfills.",
      trigger: "metric",
      achievedAt: profile.kg_recycled >= 10 ? profile.created_at : null,
      progress: Math.min(100, Math.round((profile.kg_recycled / 10) * 100)),
      rarity: 45,
    },
    {
      id: "green-champion",
      name: "Green Champion",
      description: "Earn 100 Green Credits by participating in eco-activities.",
      trigger: "metric",
      achievedAt: greenCredits >= 100 ? new Date().toISOString() : null,
      progress: Math.min(100, Math.round((greenCredits / 100) * 100)),
      rarity: 15,
    },
  ];

  // Watch for real-time changes to unlock achievements
  useEffect(() => {
    achievements.forEach((ach) => {
      if (ach.achievedAt !== null && !previouslyUnlockedIds.includes(ach.id)) {
        setUnlockedAchievement(ach);
        setShowUnlockToast(true);
        setPreviouslyUnlockedIds((prev) => [...prev, ach.id]);
        toast.success(`Achievement Unlocked: ${ach.name}! 🎉`, {
          description: ach.description || "You've earned a new milestone badge."
        });
      }
    });
  }, [profile.pickups_completed, profile.kg_recycled, greenCredits]);

  // ─── Badge slice for the dashboard (earned first, then most-progressed) ──
  // Full grid + detail lives on /profile. Same evaluateBadges() data source.
  const STATE_RANK: Record<string, number> = { earned: 0, "in-progress": 1, locked: 2 };
  const earnedCount = badges.filter((b) => b.unlocked).length;
  const badgeSlice = [...badges]
    .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || b.pct - a.pct)
    .slice(0, 6);

  // ─── Marketplace unlock teaser (same gate as marketplace/page.tsx: 500 credits + 1 pickup) ──
  const pickupsDone = profile.pickups_completed ?? 0;
  const marketplaceUnlocked = greenCredits >= 500 && pickupsDone >= 1;
  const creditGatePct = Math.min(100, Math.round((greenCredits / 500) * 100));

  // ─── Cancel & Reschedule Handlers ─────────────────────────────────
  const handleCancelPickup = async (targetId: string, pickup: PickupRequest) => {
    const status = pickup.status as string;
    const isDispatchedOrAssigned = 
      status === "accepted" || 
      status === "confirmed" || 
      status === "assigned" || 
      status === "dispatched";

    if (isDispatchedOrAssigned) {
      let pickupTime = new Date(pickup.scheduled_date);
      if (typeof pickup.scheduled_date === "string" && !pickup.scheduled_date.includes("T") && !pickup.scheduled_date.includes(" ")) {
        pickupTime = new Date(pickup.scheduled_date + "T09:00:00");
      }
      
      const currentTime = new Date();
      const diffMs = pickupTime.getTime() - currentTime.getTime();
      const diffMinutes = Math.abs(diffMs / (1000 * 60));

      if (diffMinutes <= 120) {
        toast.error("Cancellation Locked: Collection crew has already dispatched for your zone.");
        return;
      }
    }

    const { error } = await supabase
      .from("pickup_requests")
      .update({ status: "cancelled" })
      .eq("id", targetId);

    if (error) {
      toast.error("Failed to cancel pickup. Please try again.");
      console.error("Cancel error:", error);
    } else {
      toast.success("Pickup request cancelled successfully.");
      refreshPickups();
    }
  };

  const handleReschedulePickup = async (targetId: string, newDate: string, newTimeSlot: string) => {
    const { error } = await supabase
      .from("pickup_requests")
      .update({ 
        scheduled_date: newDate,
        time_slot: newTimeSlot
      })
      .eq("id", targetId);

    if (error) {
      toast.error("Failed to reschedule pickup. Please try again.");
      console.error("Reschedule error:", error);
    } else {
      toast.success(
        `Pickup rescheduled to ${new Date(newDate).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })} (${newTimeSlot}).`
      );
      setPickups(prev => prev.map(p => 
        p.id === targetId 
          ? { ...p, scheduled_date: newDate, time_slot: newTimeSlot } 
          : p
      ));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 relative z-10 font-[family-name:var(--font-dm)]">
      {/* Welcome Header */}
      <div className="w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-6 pb-4 relative z-10 min-h-[auto] animate-fade-up">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-950 leading-tight block py-1">
            Welcome back,{" "}
            <span className="text-gradient-terra font-semibold">{fullName}</span>{" "}
            <span className="inline-flex items-center justify-center h-8 w-8 relative align-middle ml-1 animate-float" title={activeTier.rank}>
              {/* Supabase PNG */}
              <img 
                src={activeTierIconUrl} 
                alt={activeTier.rank} 
                crossOrigin="anonymous"
                className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(44,31,20,0.15)]"
              />
            </span>
          </h1>
          <p className="mt-1 text-sm text-smoke">
            Rank: <span className="font-semibold text-bark">{activeTier.rank}</span> • Here&apos;s your environmental impact overview
          </p>
        </div>
        <SchedulePickupModal
          userId={profile?.id ?? ""}
          userName={profile?.full_name || profile?.email || "User"}
          onScheduled={refreshPickups}
        />
      </div>

      {/* Impact Cards */}
      <div className="grid gap-5 sm:grid-cols-3 mb-8 animate-fade-up-delay-1">
        <ImpactCard
          title="Green Credits"
          value={credits}
          subtitle="Total earned to date"
          icon="credits"
        />
        <ImpactCard
          title="Kg Recycled"
          value={kgRecycled.toFixed(1)}
          subtitle="Waste diverted from landfills"
          icon="recycled"
        />
        <ImpactCard
          title="CO₂ Saved"
          value={`${co2Saved.toFixed(1)} kg`}
          subtitle="Carbon footprint offset"
          icon="co2"
        />
      </div>

      {/* Eco Level + Recent Pickups */}
      <div className="grid gap-6 lg:grid-cols-3 animate-fade-up-delay-2">
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* "Your Grove" — one cohesive gamification cluster: eco-level, streak, badges, ways-to-earn */}
          <div className="flex items-center gap-2.5 animate-fade-up-delay-1">
            <Sprout className="h-6 w-6 shrink-0 text-[#7A9E7E]" aria-hidden="true" />
            <div>
              <h2 className="font-[family-name:var(--font-syne)] text-xl font-bold leading-none text-bark">Your Grove</h2>
              <p className="mt-1 font-[family-name:var(--font-dm)] text-[11px] text-smoke">Your eco-level, streak &amp; accolades in one place</p>
            </div>
          </div>

          <div className="animate-fade-up-delay-1">
            <EcoLevelBadge greenCredits={credits} />
          </div>

          {isHousehold && (
            <div className="animate-fade-up-delay-2 t-glass-card rounded-xl p-6 shadow-sm border border-[rgba(196,112,74,0.18)] transition-all duration-300 hover:shadow-md flex flex-col gap-6">
              <div className="space-y-1">
                <h3 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark">
                  Streak &amp; Daily Actions
                </h3>
                <p className="text-xs text-smoke">Track your green activities and accolades</p>
              </div>

              <StreakCard
                streak={computedPeriods}
                currentStreak={currentStreak}
                longestStreak={longestStreak}
                total={profile.pickups_completed}
                title="Pickups Streak"
                primaryColor="#C4704A"
                accentColor="#7A9E7E"
                textColor="#2C1F14"
                theme="light"
                showHowItWorks={true}
                onLaunchQuiz={handleLaunchQuiz}
                hasPickupToday={hasPickupToday}
                isWasteSegregated={isWasteSegregated}
                onLogWasteSegregation={handleLogWasteSegregation}
                activityDoneToday={hasDailyActionToday}
              />
            </div>
          )}

          {isHousehold && (
            <div className="animate-fade-up-delay-3 t-glass-card rounded-xl p-6 shadow-sm border border-[rgba(196,112,74,0.18)] bg-[#EDE5D8]/30 backdrop-blur-md flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h4 className="font-[family-name:var(--font-syne)] text-sm font-semibold text-bark">
                  My Badges <span className="font-mono text-xs font-normal text-[#6B5744]">· {earnedCount}/{badges.length} earned</span>
                </h4>
                <Link href="/profile" className="text-[11px] font-syne font-bold uppercase tracking-wider text-[#C4704A] hover:text-[#A0522D] inline-flex items-center gap-1 transition-colors">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {badgeSlice.length === 0 ? (
                <p className="font-dm text-xs text-[#6B5744] py-4 text-center">No badges yet — schedule your first pickup to start earning.</p>
              ) : (
                <div className="grid grid-cols-3 gap-4 mt-1">
                  {badgeSlice.map((badge) => {
                    const earned = badge.state === "earned";
                    const inProgress = badge.state === "in-progress";
                    return (
                      <div key={badge.id} className="flex flex-col items-center" title={badge.title}>
                        <div className="relative">
                          {inProgress && (
                            <div
                              className="absolute -inset-1 rounded-full"
                              style={{ background: `conic-gradient(#7A9E7E ${badge.pct}%, rgba(196,112,74,0.12) 0)` }}
                              aria-hidden
                            />
                          )}
                          <div className="h-16 w-16 rounded-full bg-[#F4EFE6]/90 p-2 flex items-center justify-center border border-[#D4C5B0]/40 relative">
                            {badge.image_filename ? (
                              <img
                                src={`${BADGE_BUCKET_BASE}/${badge.image_filename}`}
                                alt=""
                                className={cn(
                                  "w-full h-full object-contain",
                                  earned ? "drop-shadow-[0_2px_4px_rgba(74,103,65,0.15)]" : inProgress ? "opacity-90" : "grayscale opacity-40"
                                )}
                              />
                            ) : (
                              <span className="font-syne font-bold text-base text-[#6B5744]">{badge.title.charAt(0)}</span>
                            )}
                          </div>
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
                        <span className="font-syne text-[11px] font-bold text-center text-[#2C1F14] mt-2 line-clamp-1 w-full">
                          {badge.title}
                        </span>
                        {inProgress && Number.isFinite(badge.target) && (
                          <span className="font-mono text-[9px] text-[#6B5744]">{badge.pct}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="font-dm text-[11px] text-[#6B5744] tracking-normal text-left mt-1">
                Badges unlock automatically as your real stats grow — credits, pickups, and materials recycled.
              </p>
            </div>
          )}

          {isHousehold && (
            <div className="animate-fade-up-delay-4 t-glass-card rounded-xl p-6 shadow-sm border border-[rgba(196,112,74,0.18)] bg-[#EDE5D8]/30 backdrop-blur-md flex flex-col gap-4">
              <h4 className="font-[family-name:var(--font-syne)] text-sm font-semibold text-bark">
                Ways to Earn Credits
              </h4>
              <ul className="flex flex-col gap-2.5">
                {[
                  { icon: Recycle, label: "Log daily waste segregation", value: "+2 / day" },
                  { icon: HelpCircle, label: "Eco-knowledge quiz", value: "+1 · up to 5/day" },
                  { icon: Truck, label: "Complete a scheduled pickup", value: "credits / kg" },
                ].map(({ icon: Icon, label, value }) => (
                  <li key={label} className="flex items-center gap-3 rounded-lg border border-[#D4C5B0]/40 bg-[#F4EFE6]/50 p-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7A9E7E]/15 text-[#4A6741]">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="font-dm text-xs text-[#2C1F14] flex-1">{label}</span>
                    <span className="font-mono text-[11px] font-bold text-[#C4704A] whitespace-nowrap">{value}</span>
                  </li>
                ))}
              </ul>

              {/* Marketplace teaser — real gate (500 credits + 1 pickup) */}
              <div className="mt-1 rounded-xl border border-[#C4704A]/25 bg-[#C4704A]/5 p-3.5">
                {marketplaceUnlocked ? (
                  <Link href="/marketplace" className="flex items-center gap-3 group">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C4704A]/15 text-[#C4704A]">
                      <Gift className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="flex-1">
                      <span className="font-syne text-xs font-bold text-[#2C1F14] block">Rewards Marketplace unlocked</span>
                      <span className="font-dm text-[11px] text-[#6B5744]">Redeem your {greenCredits.toLocaleString()} credits</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-[#C4704A] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="h-3.5 w-3.5 text-[#6B5744]" aria-hidden="true" />
                      <span className="font-syne text-xs font-bold text-[#2C1F14]">Unlock the Rewards Marketplace</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-sand/35 mb-2">
                      <div className="h-full rounded-full bg-gradient-to-r from-terra to-sage transition-all duration-700" style={{ width: `${creditGatePct}%` }} />
                    </div>
                    <ul className="flex flex-col gap-1 font-dm text-[11px] text-[#6B5744]">
                      <li className="flex items-center gap-1.5">
                        {greenCredits >= 500 ? <Check className="h-3 w-3 text-[#4A6741]" strokeWidth={3} /> : <span className="inline-block h-3 w-3 rounded-full border border-[#D4C5B0]" />}
                        {greenCredits >= 500 ? "500 credits reached" : `${(500 - greenCredits).toLocaleString()} more credits (${greenCredits.toLocaleString()}/500)`}
                      </li>
                      <li className="flex items-center gap-1.5">
                        {pickupsDone >= 1 ? <Check className="h-3 w-3 text-[#4A6741]" strokeWidth={3} /> : <span className="inline-block h-3 w-3 rounded-full border border-[#D4C5B0]" />}
                        {pickupsDone >= 1 ? "First pickup completed" : "Complete 1 pickup"}
                      </li>
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 t-glass-card p-6 flex flex-col gap-4">
          <h3 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark">
            Recent Pickups
          </h3>
          <RecentPickups pickups={pickups} onCancel={handleCancelPickup} onReschedule={handleReschedulePickup} />
        </div>
      </div>



      {/* Leaderboard segment (Household role gate) — real households only, ranked by Green Credits */}
      {isHousehold && (
        <div className="mt-8 animate-fade-up-delay-3">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark inline-flex items-center gap-2">
                <Trophy className="h-5 w-5 text-[#C4704A]" aria-hidden="true" /> Sector Leaderboard
              </h3>
              <p className="text-xs text-smoke font-[family-name:var(--font-dm)]">
                Real households in your region, ranked by Green Credits.
              </p>
            </div>
            {myRank && rivalAbove ? (
              <p className="font-[family-name:var(--font-dm)] text-xs text-[#6B5744] inline-flex items-center gap-1.5 rounded-full border border-[#C4704A]/25 bg-[#C4704A]/5 px-3 py-1.5">
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#C4704A]" aria-hidden="true" />
                <span>
                  <span className="font-mono font-bold text-[#C4704A]">{creditsToOvertake.toLocaleString()}</span> credits to overtake{" "}
                  <span className="font-semibold text-bark">{rivalAbove.userName}</span>
                </span>
              </p>
            ) : myRank && myRank.rank === 1 ? (
              <p className="font-[family-name:var(--font-dm)] text-xs text-[#4A6741] inline-flex items-center gap-1.5 rounded-full border border-[#7A9E7E]/30 bg-[#7A9E7E]/10 px-3 py-1.5">
                <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> You&apos;re leading {selectedSectorLabel} — keep it growing!
              </p>
            ) : null}
          </div>

          {sectorRankings.length === 0 ? (
            <div className="t-glass-card rounded-xl p-8 shadow-sm border border-[rgba(196,112,74,0.18)] bg-[#EDE5D8]/40 backdrop-blur-md flex flex-col items-center gap-3 text-center">
              <Trophy className="h-8 w-8 text-[#C4704A]/40" aria-hidden="true" />
              <p className="font-[family-name:var(--font-dm)] text-sm text-[#6B5744]">
                No households ranked in {selectedSectorLabel} yet.
              </p>
              <select
                aria-label="Select leaderboard sector"
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="bg-background text-foreground rounded-md border px-3 py-1.5 text-sm"
              >
                {sectorRunOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          ) : (
            <LeaderboardCard
              title={`${selectedSectorLabel} · Green Credits`}
              fromDate={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)}
              toDate={new Date()}
              podiumRankings={sectorPodium}
              rankings={sectorRankings}
              currentUserId={profile.id}
              runOptions={sectorRunOptions}
              selectedRunId={selectedSector}
              onRunChange={(runId) => setSelectedSector(runId)}
              primaryColor="#C4704A"
              accentColor="#7A9E7E"
              textColor="#2C1F14"
              theme="light"
              className="t-glass-card rounded-xl p-6 shadow-sm border border-[rgba(196,112,74,0.18)] bg-[#EDE5D8]/40 backdrop-blur-md"
            />
          )}
        </div>
      )}

      {/* Eco-Knowledge Quiz Modal Overlay */}
      {isQuizOpen && currentQuestion && (
        <div className="fixed inset-0 bg-[#2C1F14]/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fadeIn" style={{ margin: 0 }}>
          <div className="bg-[#F4EFE6] border border-[#D4C5B0] w-full max-w-md p-6 rounded-xl shadow-xl mx-4 text-bark relative">
            <h3 className="font-syne font-bold text-lg text-[#2C1F14] mb-2">Eco-Knowledge Micro-Quiz</h3>
            <p className="text-xs text-smoke font-[family-name:var(--font-dm)] mb-5">Test your waste recycling awareness and earn bonus credits</p>
            
            <div className="mb-5 bg-[#EDE5D8]/30 rounded-xl p-4 border border-[#D4C5B0]/30">
              <span className="text-xs font-semibold uppercase tracking-wider text-smoke block mb-1 font-[family-name:var(--font-syne)]">Trivia Question</span>
              <p className="text-sm font-semibold text-[#2C1F14] font-[family-name:var(--font-dm)] leading-relaxed">
                {currentQuestion.q}
              </p>
            </div>

            <div className="space-y-2 mb-6">
              {currentQuestion.a.map((option: string, index: number) => {
                const isSelected = selectedAnswer === index;
                const showResult = quizSubmitted;
                const isCorrect = index === currentQuestion.correct;
                
                let btnStyle = "w-full text-left p-3.5 rounded-xl border transition-all text-sm font-medium font-[family-name:var(--font-dm)] cursor-pointer ";
                if (showResult) {
                  if (isCorrect) {
                    btnStyle += "bg-[#7A9E7E]/15 border-[#7A9E7E] text-[#4A6741]";
                  } else if (isSelected) {
                    btnStyle += "bg-red-50 border-red-300 text-red-800";
                  } else {
                    btnStyle += "bg-[#EDE5D8]/20 border-[#D4C5B0]/20 text-smoke/60 cursor-not-allowed";
                  }
                } else {
                  if (isSelected) {
                    btnStyle += "bg-[#EDE5D8] border-[#C4704A] text-[#2C1F14] ring-1 ring-[#C4704A]";
                  } else {
                    btnStyle += "bg-white/60 border-[#D4C5B0]/50 hover:bg-[#EDE5D8]/40 hover:border-[#C4704A]/30 text-[#2C1F14]";
                  }
                }

                return (
                  <button
                    key={index}
                    type="button"
                    disabled={quizSubmitted}
                    onClick={() => setSelectedAnswer(index)}
                    className={btnStyle}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {quizSubmitted && (
              <div className="mb-6 animate-fadeIn">
                {selectedAnswer === currentQuestion.correct ? (
                  <div className="p-4 rounded-xl bg-[#7A9E7E]/10 text-[#4A6741] border border-[#7A9E7E]/30 text-center font-[family-name:var(--font-dm)] text-xs font-semibold leading-relaxed">
                    🎉 {quizFeedbackText}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-red-50 text-red-700 border border-red-200 text-center font-[family-name:var(--font-dm)] text-xs font-semibold leading-relaxed">
                    ❌ {quizFeedbackText}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              {!quizSubmitted ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsQuizOpen(false)}
                    className="flex-1 bg-transparent hover:bg-sand/15 text-[#2C1F14] font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm border border-sand/40 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitQuiz}
                    disabled={selectedAnswer === null}
                    className="flex-1 bg-[#C4704A] hover:bg-[#B35E39] text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm border-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Submit
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsQuizOpen(false)}
                  className="w-full bg-[#C4704A] hover:bg-[#B35E39] text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm border-0 cursor-pointer"
                >
                  Close Quiz
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {unlockedAchievement && (
        <AchievementUnlocked
          achievement={{
            id: unlockedAchievement.id,
            name: unlockedAchievement.name,
            description: unlockedAchievement.description || "You've reached a new sustainability milestone!",
            trigger: unlockedAchievement.trigger,
            unlockedAt: unlockedAchievement.achievedAt || new Date().toISOString()
          }}
          open={showUnlockToast}
          onOpenChange={setShowUnlockToast}
        />
      )}
    </div>
  );
}

