/**
 * Granular waste leaf types grouped for display, each mapped to the pricing bucket (WasteType)
 * it quotes against. Single source of truth shared by the household booking modal and the crew
 * doorstep estimator — keep the leaf→bucket map in lockstep with price_estimates / lib/estimate.ts.
 * Categories are visual grouping only (not selectable). Battery rates are seeded from E-Waste (TODO(ml-battery)).
 * Client-safe: no server imports.
 */
import type { WasteType } from "@/lib/types";

const bucketed = (labels: string[], bucket: WasteType) => labels.map((label) => ({ label, bucket }));

export const WASTE_CATALOG: { category: string; items: { label: string; bucket: WasteType }[] }[] = [
  { category: "Metals", items: bucketed(["Aluminum", "Brass", "Copper", "Iron", "Stainless Steel", "Tin"], "Metal") },
  { category: "Batteries", items: bucketed(["Car Battery", "Inverter Battery", "Lead Acid Battery", "Lithium Ion Battery", "Two Wheeler Battery", "UPS Battery"], "Battery") },
  { category: "Paper & Packaging", items: bucketed(["Cardboard", "Newspaper"], "Paper") },
  { category: "Appliances & Electronics", items: bucketed(["AC Compressor", "E-Waste"], "E-Waste") },
  { category: "Plastics", items: bucketed(["Plastic"], "Plastic") },
  { category: "Other General Waste", items: [{ label: "Glass", bucket: "Glass" }, { label: "Organic", bucket: "Organic" }, { label: "Mixed", bucket: "Mixed" }] },
];

export const ITEM_BUCKET = new Map(WASTE_CATALOG.flatMap((c) => c.items.map((i) => [i.label, i.bucket] as const)));
export const BUCKET_ORDER = [...new Set(WASTE_CATALOG.flatMap((c) => c.items.map((i) => i.bucket)))];

/** Selected labels + their per-material weights → priced entries for estimateMultiQuote. */
export const toEntries = (items: string[], kg: Record<string, string>) =>
  items.map((label) => ({ wasteType: ITEM_BUCKET.get(label) as WasteType, quantityKg: parseFloat(kg[label]) || 0 }));

export const totalKg = (items: string[], kg: Record<string, string>) =>
  items.reduce((s, label) => s + (parseFloat(kg[label]) || 0), 0);

/** Storage bucket for waste_type = bucket carrying the most weight; ties broken by catalog order. */
export function dominantBucket(items: string[], kg: Record<string, string>): WasteType {
  const w = new Map<WasteType, number>();
  for (const b of BUCKET_ORDER) w.set(b, 0);
  for (const i of items) { const b = ITEM_BUCKET.get(i); if (b) w.set(b, (w.get(b) ?? 0) + (parseFloat(kg[i]) || 0)); }
  let best = BUCKET_ORDER[0], bestN = -1;
  for (const b of BUCKET_ORDER) { const n = w.get(b) ?? 0; if (n > bestN) { bestN = n; best = b; } }
  return best;
}
