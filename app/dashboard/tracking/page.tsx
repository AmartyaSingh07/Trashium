import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TrackingContent from "./tracking-content";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Live Tracking | Trashium",
  description:
    "Track your assigned waste collection crew in real-time with live GPS telemetry.",
};

export default async function TrackingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch the user's profile to determine their operating zone
  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, full_name, role, operating_zone")
    .eq("id", user.id)
    .maybeSingle();

  const profile = {
    id: user.id,
    full_name:
      profileData?.full_name ??
      user.user_metadata?.full_name ??
      user.email?.split("@")[0] ??
      "User",
    role: profileData?.role ?? "household",
    operating_zone: profileData?.operating_zone ?? "Rishra",
  };

  return <TrackingContent userProfile={profile} />;
}
