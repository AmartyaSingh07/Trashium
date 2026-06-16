import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import MarketplaceContent from "./marketplace-content";
import { getLevelNumber } from "@/lib/gamification";
import { isBadgeUnlocked } from "@/lib/badges";
import type { Badge, MarketplaceItem, RedemptionOrder } from "@/lib/types";

export const metadata = {
  title: "Marketplace",
  description: "Redeem your Green Credits for eco-merch and perks.",
};

export interface MarketplaceItemView extends MarketplaceItem {
  affordable: boolean;
  meetsLevel: boolean;
  meetsBadge: boolean;
  inStock: boolean;
  redeemable: boolean;
  lockReason: string | null;
}

export default async function MarketplacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Marketplace is the household experience; send other roles to their own area.
  const role = (profileData?.role ?? "household") as string;
  if (role === "crew" || role === "collector") redirect("/crew");
  if (role === "admin") redirect("/admin");

  const credits = Number(profileData?.green_credits ?? 0);
  const pickupsCompleted = Number(profileData?.pickups_completed ?? 0);
  const profileLike = {
    green_credits: credits,
    pickups_completed: pickupsCompleted,
    kg_recycled: Number(profileData?.kg_recycled ?? 0),
  };

  const [{ data: itemsData }, { data: badgeCatalog }, { data: userBadges }, { data: ordersData }] =
    await Promise.all([
      supabase
        .from("marketplace_items")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("badges").select("*"),
      supabase.from("user_badges").select("badge_id").eq("user_id", user.id),
      supabase
        .from("redemption_orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  const badgeById: Record<string, Badge> = {};
  for (const b of badgeCatalog ?? []) badgeById[b.id] = b as Badge;
  const manualBadgeIds = (userBadges ?? []).map((r) => r.badge_id as string);
  // Minimal signals: the only badge-gated items today require b14 (credits) / b15 (manual).
  const signals = { manualBadgeIds, distinctCategories: 0, kgByMaterial: {} as Record<string, number> };

  const level = getLevelNumber(credits);

  const items: MarketplaceItemView[] = (itemsData ?? []).map((raw) => {
    const item = raw as MarketplaceItem;
    const requiredBadge = item.badge_requirement ? badgeById[item.badge_requirement] : null;
    const meetsLevel = item.level_requirement == null || level >= item.level_requirement;
    const meetsBadge = !requiredBadge || isBadgeUnlocked(requiredBadge, profileLike, signals);
    const affordable = credits >= item.cost_credits;
    const inStock = item.stock == null || item.stock > 0;
    const redeemable = meetsLevel && meetsBadge && affordable && inStock;

    let lockReason: string | null = null;
    if (!inStock) lockReason = "Out of stock";
    else if (!meetsBadge && requiredBadge) lockReason = `Requires the ${requiredBadge.title} badge`;
    else if (!meetsLevel) lockReason = `Reach Level ${item.level_requirement}`;
    else if (!affordable)
      lockReason = `Need ${(item.cost_credits - credits).toLocaleString()} more credits`;

    return { ...item, affordable, meetsLevel, meetsBadge, inStock, redeemable, lockReason };
  });

  // Access gate (D1-NOTE / TODO(dual-balance)): spending below 500 can re-lock access — accepted.
  const gateUnlocked = credits >= 500 && pickupsCompleted >= 1;

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-muted/20">
        <MarketplaceContent
          items={items}
          initialBalance={credits}
          pickupsCompleted={pickupsCompleted}
          gateUnlocked={gateUnlocked}
          initialOrders={(ordersData as RedemptionOrder[]) ?? []}
          userId={user.id}
        />
      </main>
      <Footer />
    </>
  );
}
