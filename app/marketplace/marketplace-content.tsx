"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, Coins, CheckCircle2, Package } from "lucide-react";
import type { RedemptionOrder } from "@/lib/types";
import type { MarketplaceItemView } from "./page";

const TIER_ORDER = ["seedling", "sapling", "perk", "forest", "legendary"] as const;
const TIER_LABELS: Record<string, string> = {
  seedling: "Seedling",
  sapling: "Sapling",
  perk: "Perks",
  forest: "Forest",
  legendary: "Legendary",
};

// Item art comes from this bucket once uploaded; null filename → neutral placeholder.
const ITEM_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co"}/storage/v1/object/public/marketplace-items`;

const ERROR_MESSAGES: Record<string, string> = {
  insufficient_credits: "You don't have enough credits for this.",
  locked_level: "You haven't reached the required level yet.",
  locked_badge: "You don't have the required badge yet.",
  out_of_stock: "This item just went out of stock.",
  inactive: "This item is no longer available.",
  not_authenticated: "Your session expired — please log in again.",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  dispatched: "bg-sky-100 text-sky-800 border-sky-300",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-red-100 text-red-700 border-red-300",
};

interface Props {
  items: MarketplaceItemView[];
  initialBalance: number;
  pickupsCompleted: number;
  gateUnlocked: boolean;
  initialOrders: RedemptionOrder[];
  userId: string;
}

export default function MarketplaceContent({
  items,
  initialBalance,
  pickupsCompleted,
  gateUnlocked,
  initialOrders,
  userId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [balance, setBalance] = useState(initialBalance);
  const [orders, setOrders] = useState<RedemptionOrder[]>(initialOrders);
  const [confirmItem, setConfirmItem] = useState<MarketplaceItemView | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const refreshOrders = async () => {
    const { data } = await supabase
      .from("redemption_orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (data) setOrders(data as RedemptionOrder[]);
  };

  const handleRedeem = async (item: MarketplaceItemView) => {
    setRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_marketplace_item", { p_item_id: item.id });
    setRedeeming(false);

    if (error) {
      toast.error("Redemption failed. Please try again.");
      return;
    }
    const res = data as { success: boolean; new_balance?: number; error?: string };
    if (!res.success) {
      toast.error(ERROR_MESSAGES[res.error ?? ""] ?? "Could not redeem this item.");
      setConfirmItem(null);
      return;
    }

    setBalance(res.new_balance ?? balance - item.cost_credits);
    setConfirmItem(null);
    toast.success(`Redeemed ${item.name}! See "My Redemptions" below.`);
    await refreshOrders();
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 relative z-10 font-[family-name:var(--font-dm)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6">
        <div>
          <span className="t-label text-sage-deep flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Rewards
          </span>
          <h1 className="font-[family-name:var(--font-syne)] text-2xl md:text-3xl font-bold text-bark tracking-tight mt-1">
            Trashium Marketplace
          </h1>
          <p className="mt-1 text-sm text-smoke">
            Spend your Green Credits on eco-merch and perks.
          </p>
        </div>
        <div className="t-glass-card px-5 py-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-terra/10 text-terra">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <p className="t-label text-smoke">Your balance</p>
            <p className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-bark leading-tight">
              {balance.toLocaleString()} <span className="text-xs text-smoke font-normal">credits</span>
            </p>
          </div>
        </div>
      </div>

      {!gateUnlocked ? (
        <LockedHero balance={balance} pickupsCompleted={pickupsCompleted} />
      ) : (
        <>
          {TIER_ORDER.map((tier) => {
            const tierItems = items.filter((it) => it.tier === tier);
            if (tierItems.length === 0) return null;
            return (
              <section key={tier} className="mb-10">
                <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark mb-4 flex items-center gap-2">
                  {TIER_LABELS[tier]}
                  <span className="text-xs font-normal text-smoke">({tierItems.length})</span>
                </h2>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {tierItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      balance={balance}
                      onRedeem={() => setConfirmItem(item)}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <MyRedemptions orders={orders} />
        </>
      )}

      {/* Confirm modal */}
      <Dialog open={!!confirmItem} onOpenChange={(open) => !open && setConfirmItem(null)}>
        <DialogContent className="bg-linen border-sand/35 font-[family-name:var(--font-dm)]">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-syne)] text-xl font-bold text-bark">
              Confirm redemption
            </DialogTitle>
            <DialogDescription className="text-sm text-smoke">
              {confirmItem
                ? `Redeem ${confirmItem.name} for ${confirmItem.cost_credits.toLocaleString()} credits?`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {confirmItem && (
            <div className="rounded-xl border border-sand/40 bg-linen/60 p-4 text-sm text-bark space-y-1.5">
              <div className="flex justify-between">
                <span className="text-smoke">Cost</span>
                <span className="font-semibold">{confirmItem.cost_credits.toLocaleString()} credits</span>
              </div>
              <div className="flex justify-between">
                <span className="text-smoke">Balance after</span>
                <span className="font-semibold">
                  {(balance - confirmItem.cost_credits).toLocaleString()} credits
                </span>
              </div>
              {confirmItem.perk_type === "payout_boost" && (
                <p className="text-xs text-sage-deep pt-1">
                  Applies +{confirmItem.perk_value}% to your next pickup payout.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmItem(null)}
              className="border-sand/40 hover:bg-sand/10 text-bark font-semibold rounded-full px-5"
            >
              Cancel
            </Button>
            <button
              type="button"
              disabled={redeeming}
              onClick={() => confirmItem && handleRedeem(confirmItem)}
              className="btn-terra text-xs px-6 py-2.5 border-0 cursor-pointer disabled:opacity-50"
            >
              {redeeming ? "Redeeming…" : "Confirm redemption"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemCard({
  item,
  balance,
  onRedeem,
}: {
  item: MarketplaceItemView;
  balance: number;
  onRedeem: () => void;
}) {
  return (
    <div
      className={`t-glass-card p-5 flex flex-col gap-3 ${
        item.redeemable ? "" : "opacity-80"
      }`}
    >
      {/* Image / placeholder */}
      <div className="aspect-square w-full rounded-xl bg-sand/15 border border-sand/30 flex items-center justify-center overflow-hidden">
        {item.image_filename ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${ITEM_BUCKET_BASE}/${item.image_filename}`}
            alt={item.name}
            className="w-full h-full object-contain p-3"
          />
        ) : (
          <span className="font-[family-name:var(--font-syne)] text-4xl font-bold text-sand">
            {item.name.charAt(0)}
          </span>
        )}
      </div>

      <div className="flex-1">
        <h3 className="font-[family-name:var(--font-syne)] text-sm font-bold text-bark">
          {item.name}
        </h3>
        <p className="text-xs text-smoke mt-1 line-clamp-2">{item.description}</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-jetbrains)] text-sm font-bold text-terra flex items-center gap-1">
          <Coins className="h-3.5 w-3.5" />
          {item.cost_credits.toLocaleString()}
        </span>
        <span className="text-[10px] text-smoke">balance {balance.toLocaleString()}</span>
      </div>

      {item.redeemable ? (
        <button
          type="button"
          onClick={onRedeem}
          className="btn-terra text-xs px-4 py-2 border-0 cursor-pointer w-full"
        >
          Redeem
        </button>
      ) : (
        <button
          type="button"
          disabled
          title={item.lockReason ?? "Locked"}
          className="w-full text-xs px-4 py-2 rounded-full border border-sand/40 bg-sand/10 text-smoke flex items-center justify-center gap-1.5 cursor-not-allowed"
        >
          <Lock className="h-3 w-3" />
          {item.lockReason ?? "Locked"}
        </button>
      )}
    </div>
  );
}

function LockedHero({ balance, pickupsCompleted }: { balance: number; pickupsCompleted: number }) {
  const creditsOk = balance >= 500;
  const pickupOk = pickupsCompleted >= 1;
  return (
    <div className="t-glass-card p-8 md:p-12 flex flex-col items-center text-center max-w-2xl mx-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-terra/10 text-terra mb-5">
        <Lock className="h-7 w-7" />
      </div>
      <h2 className="font-[family-name:var(--font-syne)] text-xl font-bold text-bark">
        The marketplace unlocks soon
      </h2>
      <p className="text-sm text-smoke mt-2 max-w-md">
        Earn a little more impact to open the rewards catalog. You need both of these:
      </p>

      <div className="mt-6 w-full max-w-sm space-y-3 text-left">
        <GateRow
          done={creditsOk}
          label="Reach 500 Green Credits"
          detail={creditsOk ? "Done" : `${balance.toLocaleString()} / 500`}
        />
        <GateRow
          done={pickupOk}
          label="Complete at least 1 pickup"
          detail={pickupOk ? "Done" : `${pickupsCompleted} / 1`}
        />
      </div>

      <Link href="/dashboard" className="btn-terra text-xs px-6 py-2.5 border-0 mt-7">
        Go to dashboard
      </Link>
    </div>
  );
}

function GateRow({ done, label, detail }: { done: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sand/40 bg-linen/60 px-4 py-3">
      <CheckCircle2 className={`h-5 w-5 ${done ? "text-sage-deep" : "text-sand"}`} />
      <span className="flex-1 text-sm text-bark">{label}</span>
      <span className={`text-xs font-mono ${done ? "text-sage-deep" : "text-smoke"}`}>{detail}</span>
    </div>
  );
}

function MyRedemptions({ orders }: { orders: RedemptionOrder[] }) {
  return (
    <section className="mt-4">
      <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark mb-4 flex items-center gap-2">
        <Package className="h-4 w-4" /> My Redemptions
      </h2>
      {orders.length === 0 ? (
        <p className="text-sm text-smoke t-glass-card p-6">
          No redemptions yet. Redeem an item above and it&apos;ll show up here.
        </p>
      ) : (
        <div className="t-glass-card p-2 sm:p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-smoke border-b border-sand/25">
                <th className="py-2.5 px-3 text-left">Item</th>
                <th className="py-2.5 px-3 text-left">Cost</th>
                <th className="py-2.5 px-3 text-left">Date</th>
                <th className="py-2.5 px-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-sand/15 text-bark">
                  <td className="py-2.5 px-3 font-semibold">{o.item_name}</td>
                  <td className="py-2.5 px-3 font-mono text-terra">
                    {o.cost_at_redemption.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-smoke text-xs">
                    {new Date(o.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        STATUS_STYLES[o.status] ?? "bg-sand/20 text-smoke border-sand/40"
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
