import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import DashboardContent from "./dashboard-content";
import type { Profile, PickupRequest } from "@/lib/types";

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

  // Fetch recent pickups
  const { data: pickups } = await supabase
    .from("pickup_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-muted/20">
        <DashboardContent
          profile={profile}
          initialPickups={(pickups as PickupRequest[]) ?? []}
        />
      </main>
      <Footer />
    </>
  );
}
