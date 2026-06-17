import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import ProfileContent from "./profile-content";
import { evaluateBadges } from "@/lib/badges";
import type { Profile, Badge, ResolvedBadge } from "@/lib/types";

export const metadata = {
  title: "My Profile",
  description: "Manage your user profile details, default sector preferences, and track eco stats.",
};

export interface ProfileWithZone extends Profile {
  operating_zone: string | null;
}

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profiles table row
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Construct typed profile with operating_zone
  const profile: ProfileWithZone = {
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
    operating_zone: profileData?.operating_zone ?? null,
  };

  // ─── Badges: catalog + manual grants + signals derived from completed pickups ───
  const DONE_STATUSES = ["collected", "processed", "completed"];
  const [{ data: badgeCatalog }, { data: userBadges }, { data: badgePickups }] =
    await Promise.all([
      supabase.from("badges").select("*").order("sort_order", { ascending: true }),
      supabase.from("user_badges").select("badge_id").eq("user_id", user.id),
      supabase
        .from("pickup_requests")
        .select("waste_type, estimated_weight, status")
        .eq("user_id", user.id),
    ]);

  const manualBadgeIds = (userBadges ?? []).map((r) => r.badge_id as string);
  const kgByMaterial: Record<string, number> = {};
  const categorySet = new Set<string>();
  for (const p of badgePickups ?? []) {
    if (!DONE_STATUSES.includes(p.status as string)) continue;
    const wt = p.waste_type as string;
    kgByMaterial[wt] = (kgByMaterial[wt] ?? 0) + Number(p.estimated_weight ?? 0);
    categorySet.add(wt);
  }
  const signals = { manualBadgeIds, distinctCategories: categorySet.size, kgByMaterial };

  const badges: ResolvedBadge[] = evaluateBadges((badgeCatalog ?? []) as Badge[], profile, signals);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-muted/20">
        <ProfileContent profile={profile} user={user} badges={badges} />
      </main>
      <Footer />
    </>
  );
}
