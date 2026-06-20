"use server";
/**
 * estimateQuote — the ONE pricing entrypoint every estimator UI (household, crew, admin) calls.
 * Server Action so client components can call it without pulling the server Supabase client into
 * their bundle (CLAUDE.md #2/#4). The model lives behind getMarketValuePerKg() — swap that body
 * when the live model is connected; no UI change needed (TODO(connect-model)).
 */
import { createClient } from "@/lib/supabase/server";
import { buildResult, buildMultiResult, haversineKm } from "@/lib/pricing-math";
import {
  RISK_MULTIPLIER,
  DEMAND_MULTIPLIER,
  DEFAULT_DEMAND,
  ROAD_FACTOR,
  HUB_LATLNG,
  SECTOR_HUB_DISTANCE_KM,
} from "@/lib/pricing-constants";
import type { EstimateInput, EstimateResult, MultiEstimateInput } from "@/lib/estimator-types";

// pincode → pin → sector default. The v2 model trained on pincode→hub ROAD distance; a map pin
// yields straight-line (haversine), so we ×ROAD_FACTOR as an approximation. TODO(distance-matrix).
function resolveDistanceKm(input: { distanceKm?: number; latlng?: { lat: number; lng: number }; sector: string }): number {
  if (input.distanceKm != null) return input.distanceKm;
  if (input.latlng) return haversineKm(input.latlng, HUB_LATLNG) * ROAD_FACTOR;
  // No real pincode→hub table yet — pincode is captured for audit; distance falls back to the
  // per-sector road-approx default.
  return SECTOR_HUB_DISTANCE_KM[input.sector] ?? 15;
}

// THE MODEL SEAM. Today: read market_price_per_kg from price_estimates and apply RISK/DEMAND
// multipliers here so the UI responds to those inputs pre-model. When the live model lands it
// already conditions on risk/demand — REMOVE the multipliers in the model branch then.
// TODO(connect-model).
async function getMarketValuePerKg(
  input: EstimateInput
): Promise<{ value: number; source: EstimateResult["source"]; modelVersion: string | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("price_estimates")
    .select("market_price_per_kg, price_per_kg, model_version")
    .eq("area", input.sector)
    .eq("waste_type", input.wasteType)
    .maybeSingle();

  const demand = input.demand ?? DEFAULT_DEMAND;
  const adj = RISK_MULTIPLIER[input.risk] * DEMAND_MULTIPLIER[demand];

  if (data?.market_price_per_kg != null) {
    return {
      value: Number(data.market_price_per_kg) * adj,
      source: "table",
      modelVersion: data.model_version ?? null,
    };
  }
  // No market value on the row — fall back to price_per_kg as a rough market proxy, still
  // risk/demand-adjusted so the UI stays responsive.
  if (data?.price_per_kg != null) {
    return { value: Number(data.price_per_kg) * adj, source: "fallback", modelVersion: data.model_version ?? null };
  }
  // No row at all (shouldn't happen — table is the full 5×7 grid). Quote ₹0 rather than crash.
  return { value: 0, source: "fallback", modelVersion: null };
}

export async function estimateQuote(input: EstimateInput): Promise<EstimateResult> {
  const distanceKm = resolveDistanceKm(input);
  const { value, source, modelVersion } = await getMarketValuePerKg(input);
  return buildResult(value, distanceKm, input.quantityKg, source, modelVersion, input.boostPct ?? null);
}

// Multi-material pickup: quote each stream's market value, then combine into ONE stop quote
// (logistics charged once). Adding a material always adds payout — never reduces it.
export async function estimateMultiQuote(input: MultiEstimateInput): Promise<EstimateResult> {
  const distanceKm = resolveDistanceKm(input);
  const valid = input.entries.filter((e) => e.quantityKg > 0);
  const priced = await Promise.all(
    valid.map(async (e) => {
      const r = await getMarketValuePerKg({ ...input, wasteType: e.wasteType, quantityKg: e.quantityKg });
      return { mvPerKg: r.value, qtyKg: e.quantityKg, source: r.source, modelVersion: r.modelVersion };
    })
  );
  const source = priced[0]?.source ?? "fallback";
  const modelVersion = priced[0]?.modelVersion ?? null;
  return buildMultiResult(
    priced.map((p) => ({ mvPerKg: p.mvPerKg, qtyKg: p.qtyKg })),
    distanceKm,
    source,
    modelVersion,
    input.boostPct ?? null
  );
}
