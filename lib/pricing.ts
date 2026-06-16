/**
 * Pricing helper for Trashium.
 *
 * Reads the ML-generated rates from `price_estimates` (refreshed nightly by the
 * Python job in /ml) and turns them into a per-pickup payout + profit estimate.
 *
 *   Profit = MarketPrice - (BasePrice + LogisticsCost)
 *            BasePrice    = price_per_kg * weight   (what we pay the household)
 *            MarketPrice  = market_price_per_kg * weight   (recycler resale; placeholder)
 *            LogisticsCost= logistics_per_kg * weight
 *
 * `area` in price_estimates stores an OPERATIONAL SECTOR (matches the pickup form).
 */
import { createClient } from "@/lib/supabase/server";
import type { WasteType } from "@/lib/types";

// Re-exported so server code uses lib/pricing as the single pricing entrypoint. Pure math lives in pricing-math.
export { applyBoost } from "@/lib/pricing-math";

export interface RateRow {
  price_per_kg: number;
  logistics_per_kg: number | null;
  market_price_per_kg: number | null;
  profit_per_kg: number | null;
  model_version: string | null;
}

export interface PickupQuote {
  base_price: number;     // payout offered to the household (INR)
  logistics_cost: number; // INR
  market_price: number;   // INR (placeholder until market feed is wired)
  profit_margin: number;  // INR
  rate_per_kg: number;
}

/** Look up the current rate for a (sector, wasteType). Returns null if missing. */
export async function getRate(sector: string, wasteType: WasteType): Promise<RateRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_estimates")
    .select("price_per_kg, logistics_per_kg, market_price_per_kg, profit_per_kg, model_version")
    .eq("area", sector)
    .eq("waste_type", wasteType)
    .single();
  if (error) return null;
  return data as RateRow;
}

/** Compute the full per-pickup quote from a rate row and the estimated weight. */
export function quoteFromRate(rate: RateRow, weightKg: number, minMarginPerKg = 0.5): PickupQuote {
  const r = rate.price_per_kg;
  const logisticsPerKg = rate.logistics_per_kg ?? 0;
  const marketPerKg = rate.market_price_per_kg ?? r; // fallback if no market data
  const basePrice = +(r * weightKg).toFixed(2);
  const logisticsCost = +(logisticsPerKg * weightKg).toFixed(2);
  const marketPrice = +(marketPerKg * weightKg).toFixed(2);
  const profitMargin = +(marketPrice - (basePrice + logisticsCost)).toFixed(2);
  return {
    base_price: basePrice,
    logistics_cost: logisticsCost,
    market_price: marketPrice,
    profit_margin: profitMargin,
    rate_per_kg: r,
  };
}

/** Convenience: fetch the rate and quote in one call. */
export async function quotePickup(
  sector: string,
  wasteType: WasteType,
  weightKg: number
): Promise<PickupQuote | null> {
  const rate = await getRate(sector, wasteType);
  if (!rate) return null;
  return quoteFromRate(rate, weightKg);
}
