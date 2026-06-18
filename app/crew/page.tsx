import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CrewDashboardContent from "./crew-content";
import { resolveHubSectors } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CrewDashboardPage() {
  const supabase = await createClient();

  // Verify active session state
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  // Fetch true ground-truth profile identity role mapping
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, operating_zone")
    .eq("id", user.id) // Bound to securely verified server instance data!
    .single();

  // Intercept unauthorized access attempts
  if (!profile || (profile.role !== "crew" && profile.role !== "collector" && profile.role !== "admin")) {
    redirect("/dashboard"); // Bounce regular users out to household view
  }

  // Fetch active localized pickup data matching operational zones
  const { data: pickups } = await supabase
    .from("pickup_requests")
    .select("*")
    .in("location", resolveHubSectors(profile.operating_zone) as string[])
    .not("status", "eq", "cancelled")
    .order("scheduled_date", { ascending: true });

  // Map database properties to component schema
  const mappedPickups = (pickups || []).map((p: any) => ({
    id: p.id,
    scheduled_date: p.scheduled_date,
    time_slot: p.time_slot || "08:00 AM - 09:00 AM",
    operating_zone: p.location,
    weight: Number(p.estimated_weight || 0),
    status: p.status === "processed" ? "completed" : (p.status as any),
    material_type: p.waste_type,
    user_address: p.address,
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined
  }));

  return <CrewDashboardContent profile={profile} initialPickups={mappedPickups} />;
}
