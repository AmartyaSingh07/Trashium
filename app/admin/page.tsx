import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import AdminContent from "./admin-content";
import type { PriceEstimate, MarketplaceItem, RedemptionOrder } from "@/lib/types";

export const metadata = {
  title: "Admin Hub",
  description: "Manage pickup requests, track collection status, and estimate prices.",
};

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch price estimates (no recursive RLS on this table) + marketplace admin data
  const [{ data: priceEstimates }, { data: marketItems }, { data: orders }, { data: users }, { data: badges }] =
    await Promise.all([
      supabase.from("price_estimates").select("*"),
      supabase.from("marketplace_items").select("*").order("sort_order", { ascending: true }),
      supabase
        .from("redemption_orders")
        .select("*, profiles(full_name, email)")
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email").order("full_name", { ascending: true }),
      supabase.from("badges").select("id, title, unlock_type").order("sort_order", { ascending: true }),
    ]);

  const safeEstimates = (priceEstimates as PriceEstimate[]) || [];

  return (
    <>
      <Navbar />
      <main className="flex-1 bg-muted/20">
        <AdminContent
          priceEstimates={safeEstimates}
          marketItems={(marketItems as MarketplaceItem[]) ?? []}
          orders={(orders as RedemptionOrder[]) ?? []}
          users={users ?? []}
          badges={badges ?? []}
        />
      </main>
      <Footer />
    </>
  );
}
