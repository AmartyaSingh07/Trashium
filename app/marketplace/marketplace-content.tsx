"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { Reveal, Stagger } from "@/components/motion";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { RedemptionOrder } from "@/lib/types";
import { redeemItemSchema } from "@/lib/schemas";
import type { MarketplaceItemView } from "./page";

const TIER_ORDER = ["seedling", "sapling", "perk", "forest", "legendary"] as const;
// tier id → marketplace message key for its label
const TIER_LABEL_KEYS: Record<string, string> = {
  seedling: "tierSeedling",
  sapling: "tierSapling",
  perk: "tierPerk",
  forest: "tierForest",
  legendary: "tierLegendary",
};

// Item art comes from this bucket once uploaded; null filename → neutral placeholder.
const ITEM_BUCKET_BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co"}/storage/v1/object/public/marketplace-items`;

// RPC error code → marketplace message key
const ERROR_KEYS: Record<string, string> = {
  insufficient_credits: "errInsufficientCredits",
  locked_level: "errLockedLevel",
  locked_badge: "errLockedBadge",
  out_of_stock: "errOutOfStock",
  inactive: "errInactive",
  not_authenticated: "errNotAuthenticated",
};

// order status → marketplace message key for its label
const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: "statusPending",
  dispatched: "statusDispatched",
  delivered: "statusDelivered",
  cancelled: "statusCancelled",
};

// Earthy status vocabulary (mirrors globals.css .status-pending/accepted/completed): the
// warm→sage→deep-green progression encodes the fulfilment journey; cancelled uses the
// palette's own --destructive (not Tailwind red).
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-warm/15 text-clay border-amber-warm/30",
  dispatched: "bg-sage/15 text-sage-deep border-sage/30",
  delivered: "bg-moss/12 text-moss border-moss/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
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
  const t = useTranslations("marketplace");
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
    // Shape-only guard (defense-in-depth): the RPC still enforces every real rule.
    const parsed = redeemItemSchema.safeParse({ item_id: item.id });
    if (!parsed.success) {
      toast.error(t(parsed.error.issues[0]?.message ?? "redeemGeneric"));
      setConfirmItem(null);
      return;
    }

    setRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_marketplace_item", {
      p_item_id: parsed.data.item_id,
    });
    setRedeeming(false);

    if (error) {
      toast.error(t("redeemFailed"));
      return;
    }
    const res = data as { success: boolean; new_balance?: number; error?: string };
    if (!res.success) {
      const key = ERROR_KEYS[res.error ?? ""];
      toast.error(key ? t(key) : t("redeemGeneric"));
      setConfirmItem(null);
      return;
    }

    setBalance(res.new_balance ?? balance - item.cost_credits);
    setConfirmItem(null);
    toast.success(t("redeemSuccess", { name: item.name }));
    await refreshOrders();
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-7xl px-6 pt-24 pb-10 relative z-10 font-[family-name:var(--font-dm)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6">
        <div>
          <span className="t-label text-sage-deep flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> {t("eyebrow")}
          </span>
          <h1 className="font-[family-name:var(--font-syne)] text-2xl md:text-3xl font-bold text-bark tracking-tight mt-1">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-smoke">
            {t("subtitle")}
          </p>
        </div>
        <div className="t-glass-card px-5 py-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-terra/10 text-terra">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <p className="t-label text-smoke">{t("yourBalance")}</p>
            {/* leading-normal: NumberFlow clips tall digits under a tight line-height */}
            <p className="font-[family-name:var(--font-jetbrains)] text-xl font-bold text-bark leading-normal whitespace-nowrap">
              <AnimatedNumber value={balance} /> <span className="text-xs text-smoke font-normal">{t("credits")}</span>
            </p>
          </div>
        </div>
      </div>

      {!gateUnlocked ? (
        <LockedHero balance={balance} pickupsCompleted={pickupsCompleted} t={t} />
      ) : (
        <>
          {TIER_ORDER.map((tier) => {
            const tierItems = items.filter((it) => it.tier === tier);
            if (tierItems.length === 0) return null;
            return (
              <section key={tier} className="mb-10">
                <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark mb-4 flex items-center gap-2">
                  {t(TIER_LABEL_KEYS[tier])}
                  <span className="text-xs font-normal text-smoke">({tierItems.length})</span>
                </h2>
                <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {tierItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      balance={balance}
                      onRedeem={() => setConfirmItem(item)}
                      t={t}
                    />
                  ))}
                </Stagger>
              </section>
            );
          })}

          <MyRedemptions orders={orders} t={t} />
        </>
      )}

      {/* Confirm modal */}
      <Dialog open={!!confirmItem} onOpenChange={(open) => !open && setConfirmItem(null)}>
        <DialogContent className="bg-linen border-sand/35 font-[family-name:var(--font-dm)]">
          <DialogHeader>
            <DialogTitle className="font-[family-name:var(--font-syne)] text-xl font-bold text-bark">
              {t("confirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-sm text-smoke">
              {confirmItem
                ? t("confirmQuestion", {
                    name: confirmItem.name,
                    cost: confirmItem.cost_credits.toLocaleString(),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>

          {confirmItem && (
            <div className="rounded-xl border border-sand/40 bg-linen/60 p-4 text-sm text-bark space-y-1.5">
              <div className="flex justify-between">
                <span className="text-smoke">{t("cost")}</span>
                <span className="font-semibold">{confirmItem.cost_credits.toLocaleString()} {t("credits")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-smoke">{t("balanceAfter")}</span>
                <span className="font-semibold">
                  {(balance - confirmItem.cost_credits).toLocaleString()} {t("credits")}
                </span>
              </div>
              {confirmItem.perk_type === "payout_boost" && (
                <p className="text-xs text-sage-deep pt-1">
                  {t("payoutBoostNote", { value: confirmItem.perk_value ?? 0 })}
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
              {t("cancel")}
            </Button>
            <button
              type="button"
              disabled={redeeming}
              onClick={() => confirmItem && handleRedeem(confirmItem)}
              className="btn-terra text-xs px-6 py-2.5 border-0 cursor-pointer disabled:opacity-50 t-focus-ring"
            >
              {redeeming ? t("redeeming") : t("confirmRedemption")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations>;

function ItemCard({
  item,
  balance,
  onRedeem,
  t,
}: {
  item: MarketplaceItemView;
  balance: number;
  onRedeem: () => void;
  t: TFn;
}) {
  return (
    <div
      data-stagger-item
      className={`t-glass-card t-lift p-5 flex flex-col gap-3 ${
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
        <span className="text-[10px] text-smoke">{t("balanceLabel")} {balance.toLocaleString()}</span>
      </div>

      {item.redeemable ? (
        <button
          type="button"
          onClick={onRedeem}
          className="btn-terra text-xs px-4 py-2 border-0 cursor-pointer w-full t-focus-ring"
        >
          {t("redeem")}
        </button>
      ) : (
        <button
          type="button"
          disabled
          title={item.lockReason ?? t("locked")}
          className="w-full text-xs px-4 py-2 rounded-full border border-sand/40 bg-sand/10 text-smoke flex items-center justify-center gap-1.5 cursor-not-allowed"
        >
          <Lock className="h-3 w-3" />
          {item.lockReason ?? t("locked")}
        </button>
      )}
    </div>
  );
}

function LockedHero({ balance, pickupsCompleted, t }: { balance: number; pickupsCompleted: number; t: TFn }) {
  const creditsOk = balance >= 500;
  const pickupOk = pickupsCompleted >= 1;
  return (
    <div className="t-glass-card p-8 md:p-12 flex flex-col items-center text-center max-w-2xl mx-auto">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-terra/10 text-terra mb-5">
        <Lock className="h-7 w-7" />
      </div>
      <h2 className="font-[family-name:var(--font-syne)] text-xl font-bold text-bark">
        {t("lockedTitle")}
      </h2>
      <p className="text-sm text-smoke mt-2 max-w-md">
        {t("lockedSubtitle")}
      </p>

      <div className="mt-6 w-full max-w-sm space-y-3 text-left">
        <GateRow
          done={creditsOk}
          label={t("gateCredits")}
          detail={creditsOk ? t("gateDone") : `${balance.toLocaleString()} / 500`}
        />
        <GateRow
          done={pickupOk}
          label={t("gatePickup")}
          detail={pickupOk ? t("gateDone") : `${pickupsCompleted} / 1`}
        />
      </div>

      <Link href="/dashboard" className="btn-terra text-xs px-6 py-2.5 border-0 mt-7 t-focus-ring">
        {t("goToDashboard")}
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

function MyRedemptions({ orders, t }: { orders: RedemptionOrder[]; t: TFn }) {
  return (
    <Reveal as="section" className="mt-4">
      <h2 className="font-[family-name:var(--font-syne)] text-lg font-bold text-bark mb-4 flex items-center gap-2">
        <Package className="h-4 w-4" /> {t("myRedemptions")}
      </h2>
      {orders.length === 0 ? (
        <p className="text-sm text-smoke t-glass-card p-6">
          {t("noRedemptions")}
        </p>
      ) : (
        <div className="t-glass-card p-2 sm:p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-smoke border-b border-sand/25">
                <th className="py-2.5 px-3 text-left">{t("colItem")}</th>
                <th className="py-2.5 px-3 text-left">{t("colCost")}</th>
                <th className="py-2.5 px-3 text-left">{t("colDate")}</th>
                <th className="py-2.5 px-3 text-left">{t("colStatus")}</th>
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
                      {STATUS_LABEL_KEYS[o.status] ? t(STATUS_LABEL_KEYS[o.status]) : o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Reveal>
  );
}
