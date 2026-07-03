"use client";

import { useState } from "react";
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
import { Plus, Award } from "lucide-react";
import type { MarketplaceItem, RedemptionOrder, RedemptionStatus, MarketplaceTier } from "@/lib/types";

type AdminOrder = RedemptionOrder & {
  profiles?: { full_name: string | null; email: string | null } | null;
};

interface Props {
  initialItems: MarketplaceItem[];
  initialOrders: AdminOrder[];
  users: { id: string; full_name: string | null; email: string | null }[];
  badges: { id: string; title: string; unlock_type: string }[];
}

const TIERS: MarketplaceTier[] = ["seedling", "sapling", "forest", "perk", "legendary"];
const ORDER_STATUSES: RedemptionStatus[] = ["pending", "dispatched", "delivered", "cancelled"];

const inputCls =
  "w-full p-2 bg-linen/60 border border-sand/55 rounded-lg text-xs text-bark focus:outline-none focus:border-terra transition-colors";

type FormState = {
  id: string | null;
  name: string;
  description: string;
  tier: MarketplaceTier;
  cost_credits: string;
  image_filename: string;
  level_requirement: string;
  badge_requirement: string;
  stock: string;
  perk_type: string;
  perk_value: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  id: null,
  name: "",
  description: "",
  tier: "seedling",
  cost_credits: "0",
  image_filename: "",
  level_requirement: "",
  badge_requirement: "",
  stock: "",
  perk_type: "",
  perk_value: "",
  is_active: true,
};

const numOrNull = (s: string): number | null => (s.trim() === "" ? null : Number(s));
const strOrNull = (s: string): string | null => (s.trim() === "" ? null : s.trim());

export default function MarketplaceAdmin({ initialItems, initialOrders, users, badges }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<MarketplaceItem[]>(initialItems);
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const [awardUser, setAwardUser] = useState("");
  const [awardBadge, setAwardBadge] = useState("");

  const manualBadges = badges.filter((b) => b.unlock_type === "manual");

  const openNew = () => setForm({ ...emptyForm });
  const openEdit = (it: MarketplaceItem) =>
    setForm({
      id: it.id,
      name: it.name,
      description: it.description,
      tier: it.tier,
      cost_credits: String(it.cost_credits),
      image_filename: it.image_filename ?? "",
      level_requirement: it.level_requirement == null ? "" : String(it.level_requirement),
      badge_requirement: it.badge_requirement ?? "",
      stock: it.stock == null ? "" : String(it.stock),
      perk_type: it.perk_type ?? "",
      perk_value: it.perk_value == null ? "" : String(it.perk_value),
      is_active: it.is_active,
    });

  const saveItem = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.description.trim()) {
      toast.error("Name and description are required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      tier: form.tier,
      cost_credits: Number(form.cost_credits) || 0,
      image_filename: strOrNull(form.image_filename),
      level_requirement: numOrNull(form.level_requirement),
      badge_requirement: strOrNull(form.badge_requirement),
      stock: numOrNull(form.stock),
      perk_type: strOrNull(form.perk_type),
      perk_value: numOrNull(form.perk_value),
      is_active: form.is_active,
    };

    if (form.id) {
      const { data, error } = await supabase
        .from("marketplace_items")
        .update(payload)
        .eq("id", form.id)
        .select("*")
        .single();
      setSaving(false);
      if (error) return toast.error("Failed to save item.");
      setItems((prev) => prev.map((it) => (it.id === form.id ? (data as MarketplaceItem) : it)));
      toast.success("Item updated.");
    } else {
      const { data, error } = await supabase
        .from("marketplace_items")
        .insert(payload)
        .select("*")
        .single();
      setSaving(false);
      if (error) return toast.error("Failed to create item.");
      setItems((prev) => [...prev, data as MarketplaceItem]);
      toast.success("Item created.");
    }
    setForm(null);
  };

  const toggleActive = async (it: MarketplaceItem) => {
    const next = !it.is_active;
    const { error } = await supabase
      .from("marketplace_items")
      .update({ is_active: next })
      .eq("id", it.id);
    if (error) return toast.error("Failed to update.");
    setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, is_active: next } : x)));
  };

  const updateOrderStatus = async (order: AdminOrder, status: RedemptionStatus) => {
    const { error } = await supabase
      .from("redemption_orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (error) return toast.error("Failed to update order.");
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
    toast.success(`Order marked ${status}.`);
  };

  const award = async () => {
    if (!awardUser || !awardBadge) {
      toast.error("Pick a user and a badge.");
      return;
    }
    const { error } = await supabase
      .from("user_badges")
      .insert({ user_id: awardUser, badge_id: awardBadge });
    if (error) {
      // 23505 = unique violation (already awarded)
      if ((error as { code?: string }).code === "23505") {
        toast.error("That user already has this badge.");
      } else {
        toast.error("Failed to award badge.");
      }
      return;
    }
    toast.success("Badge awarded.");
    setAwardUser("");
    setAwardBadge("");
  };

  return (
    <div className="w-full max-w-7xl mx-auto mb-10 flex flex-col gap-8">
      {/* ─── Catalog management ─── */}
      <div className="t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/30 border border-[rgba(194,112,61,0.15)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218]">
            Marketplace Catalog
          </h2>
          <button
            onClick={openNew}
            className="bg-[#C2703D] hover:bg-[#A0522D] text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer border-0 flex items-center gap-1 shadow-sm t-focus-ring"
          >
            <Plus className="h-3 w-3" /> Add Item
          </button>
        </div>
        <div className="rounded-xl border border-sand/25 overflow-x-auto">
          <table className="border-collapse w-full text-xs">
            <thead>
              <tr className="bg-[#EDE5D8]/50 border-b border-[#D4C5B0] text-[10px] font-bold uppercase tracking-wider text-[#6B5744]">
                <th className="py-2.5 px-3 text-left">Name</th>
                <th className="py-2.5 px-3 text-left">Tier</th>
                <th className="py-2.5 px-3 text-left">Cost</th>
                <th className="py-2.5 px-3 text-left">Stock</th>
                <th className="py-2.5 px-3 text-left">Lvl</th>
                <th className="py-2.5 px-3 text-left">Badge</th>
                <th className="py-2.5 px-3 text-left">Active</th>
                <th className="py-2.5 px-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-sand/15 text-[#6B5744]">
                  <td className="py-2 px-3 font-semibold text-bark">{it.name}</td>
                  <td className="py-2 px-3 capitalize">{it.tier}</td>
                  <td className="py-2 px-3 font-mono text-clay">{it.cost_credits}</td>
                  <td className="py-2 px-3 font-mono">{it.stock == null ? "∞" : it.stock}</td>
                  <td className="py-2 px-3 font-mono">{it.level_requirement ?? "—"}</td>
                  <td className="py-2 px-3 font-mono">{it.badge_requirement ?? "—"}</td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => toggleActive(it)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border cursor-pointer t-focus-ring ${
                        it.is_active
                          ? "bg-sage/15 text-sage-deep border-sage/40"
                          : "bg-destructive/10 text-destructive border-destructive/30"
                      }`}
                    >
                      {it.is_active ? "Active" : "Off"}
                    </button>
                  </td>
                  <td className="py-2 px-3">
                    <button
                      onClick={() => openEdit(it)}
                      className="text-terra font-semibold hover:underline cursor-pointer"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Redemption orders ─── */}
      <div className="t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/40 border border-[rgba(194,112,61,0.18)]">
        <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-4">
          Redemption Orders
        </h2>
        <div className="rounded-xl border border-sand/25 overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="border-collapse w-full text-xs">
            <thead className="sticky top-0 bg-[#EDE5D8] z-10">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-[#6B5744] border-b border-sand/25">
                <th className="py-2.5 px-3 text-left">User</th>
                <th className="py-2.5 px-3 text-left">Item</th>
                <th className="py-2.5 px-3 text-left">Cost</th>
                <th className="py-2.5 px-3 text-left">Date</th>
                <th className="py-2.5 px-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-smoke italic">
                    No redemptions yet.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-sand/15 text-[#6B5744]">
                    <td className="py-2 px-3 font-semibold text-bark">
                      {o.profiles?.full_name || o.profiles?.email || o.user_id.substring(0, 8)}
                    </td>
                    <td className="py-2 px-3">{o.item_name}</td>
                    <td className="py-2 px-3 font-mono text-clay">{o.cost_at_redemption}</td>
                    <td className="py-2 px-3 font-mono text-[11px]">
                      {new Date(o.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="py-2 px-3">
                      <select
                        value={o.status}
                        onChange={(e) => updateOrderStatus(o, e.target.value as RedemptionStatus)}
                        className="bg-linen/60 border border-sand/55 rounded-lg text-[11px] p-1.5 text-bark cursor-pointer focus:outline-none focus:border-terra"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Award manual badge ─── */}
      <div className="t-glass-card rounded-2xl p-6 bg-[#EDE5D8]/30 border border-[rgba(194,112,61,0.15)]">
        <h2 className="font-syne font-bold text-sm uppercase tracking-wider text-[#2A2218] mb-4 flex items-center gap-2">
          <Award className="h-4 w-4" /> Award Badge
        </h2>
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B5744]">User</label>
            <select value={awardUser} onChange={(e) => setAwardUser(e.target.value)} className={inputCls}>
              <option value="">Select user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email || u.id.substring(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B5744]">
              Badge (manual)
            </label>
            <select value={awardBadge} onChange={(e) => setAwardBadge(e.target.value)} className={inputCls}>
              <option value="">Select badge…</option>
              {manualBadges.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={award}
            className="bg-[#C2703D] hover:bg-[#A0522D] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer border-0 shadow-sm t-focus-ring"
          >
            Award
          </button>
        </div>
      </div>

      {/* ─── Item editor dialog ─── */}
      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="bg-linen border-sand/35 font-[family-name:var(--font-dm)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-syne text-lg font-bold text-bark">
              {form?.id ? "Edit item" : "New item"}
            </DialogTitle>
            <DialogDescription className="text-xs text-smoke">
              Leave stock / level / badge / perk fields blank for none. Images are optional.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Name</label>
                <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Description</label>
                <textarea rows={2} className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Tier</label>
                <select className={inputCls} value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value as MarketplaceTier })}>
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Cost (credits)</label>
                <input type="number" min={0} className={inputCls} value={form.cost_credits} onChange={(e) => setForm({ ...form, cost_credits: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Stock (blank = ∞)</label>
                <input type="number" min={0} className={inputCls} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Level req (1-20)</label>
                <input type="number" min={1} max={20} className={inputCls} value={form.level_requirement} onChange={(e) => setForm({ ...form, level_requirement: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Badge req</label>
                <select className={inputCls} value={form.badge_requirement} onChange={(e) => setForm({ ...form, badge_requirement: e.target.value })}>
                  <option value="">None</option>
                  {badges.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.id} · {b.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Image filename</label>
                <input className={inputCls} value={form.image_filename} placeholder="e.g. sticker_pack.png" onChange={(e) => setForm({ ...form, image_filename: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Perk type</label>
                <input className={inputCls} value={form.perk_type} placeholder="e.g. payout_boost" onChange={(e) => setForm({ ...form, perk_type: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase text-[#6B5744]">Perk value</label>
                <input type="number" className={inputCls} value={form.perk_value} onChange={(e) => setForm({ ...form, perk_value: e.target.value })} />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-xs text-bark mt-1">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                Active (visible in the marketplace)
              </label>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setForm(null)} className="border-sand/40 text-bark font-semibold rounded-full px-5">
              Cancel
            </Button>
            <button type="button" disabled={saving} onClick={saveItem} className="btn-terra text-xs px-6 py-2.5 border-0 cursor-pointer disabled:opacity-50 t-focus-ring">
              {saving ? "Saving…" : "Save item"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
