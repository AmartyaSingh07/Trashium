import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import DashboardContent from "./dashboard-content";
import { evaluateBadges } from "@/lib/badges";
import type { Profile, PickupRequest, Badge, ResolvedBadge, LeaderboardEntry, DailyStatus } from "@/lib/types";

export const metadata = {
  title: "Dashboard",
  description:
    "Track your environmental impact, earn Green Credits, and schedule waste pickups.",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Use .maybeSingle() — returns null without an error when 0 rows match,
  // unlike .single() which treats 0 rows as a PostgREST error and suppresses data.
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Build a guaranteed non-null profile with safe default fallback for role
  const profile: Profile = {
    id: user.id,
    full_name:
      profileData?.full_name ??
      user.user_metadata?.full_name ??
      user.email?.split("@")[0] ??
      "User",
    email: profileData?.email ?? user.email ?? "",
    role: (profileData?.role ?? "household") as Profile["role"],
    eco_level: (profileData?.eco_level ?? "Seedling") as Profile["eco_level"],
    green_credits: Number(profileData?.green_credits ?? 0),
    kg_recycled: Number(profileData?.kg_recycled ?? 0),
    co2_saved: Number(profileData?.co2_saved ?? 0),
    pickups_completed: Number(profileData?.pickups_completed ?? 0),
    avatar_url: profileData?.avatar_url ?? null,
    created_at: profileData?.created_at ?? new Date().toISOString(),
    updated_at: profileData?.updated_at ?? new Date().toISOString(),
  };

  // Fetch recent pickups (for the Recent Pickups panel) + badge data, in parallel.
  const DONE_STATUSES = ["collected", "processed", "completed"];
  const [{ data: pickups }, { data: badgeCatalog }, { data: userBadges }, { data: allPickups }, { data: leaderboard }, { data: dailyStatus }] =
    await Promise.all([
      supabase
        .from("pickup_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase.from("badges").select("*").order("sort_order", { ascending: true }),
      supabase.from("user_badges").select("badge_id").eq("user_id", user.id),
      supabase.from("pickup_requests").select("waste_type, estimated_weight, status").eq("user_id", user.id),
      // Households-only leaderboard (SECURITY DEFINER RPC; excludes admin/crew). Real registered users only.
      supabase.rpc("get_household_leaderboard"),
      // Authoritative daily-ritual state (today's actions + streak/freezes/weekly), SECURITY DEFINER.
      supabase.rpc("get_daily_status"),
    ]);

  // Badge signals derived from completed pickups (same shape as profile/page.tsx).
  const manualBadgeIds = (userBadges ?? []).map((r) => r.badge_id as string);
  const kgByMaterial: Record<string, number> = {};
  const categorySet = new Set<string>();
  for (const p of allPickups ?? []) {
    if (!DONE_STATUSES.includes(p.status as string)) continue;
    const wt = p.waste_type as string;
    kgByMaterial[wt] = (kgByMaterial[wt] ?? 0) + Number(p.estimated_weight ?? 0);
    categorySet.add(wt);
  }
  const badges: ResolvedBadge[] = evaluateBadges(
    (badgeCatalog ?? []) as Badge[],
    profile,
    { manualBadgeIds, distinctCategories: categorySet.size, kgByMaterial }
  );

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-muted/20">
        <DashboardContent
          profile={profile}
          initialPickups={(pickups as PickupRequest[]) ?? []}
          badges={badges}
          leaderboard={(leaderboard as LeaderboardEntry[]) ?? []}
          dailyStatus={(dailyStatus as DailyStatus) ?? null}
        />
      </main>
      <Footer />
    </>
  );
}
