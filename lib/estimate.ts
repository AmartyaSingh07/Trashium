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
  MODEL_API_URL,
  MODEL_API_TOKEN,
  MODEL_API_TIMEOUT_MS,
  EXPECTED_STOPS_PER_RUN,
  STOPS_PER_RUN_MIN,
  STOPS_PER_RUN_MAX,
} from "@/lib/pricing-constants";
import type { EstimateInput, EstimateResult, MultiEstimateInput } from "@/lib/estimator-types";

// Live model call. Risk + demand are REAL model features, so a model-sourced market value already
// reflects them — callers must NOT re-apply RISK/DEMAND multipliers to it. Returns null on any
// error/timeout (missing URL, network, non-200, bad shape) so the caller falls back to the table.
async function callModel(
  sector: string,
  material: string,
  risk: string,
  demand: string,
): Promise<{ value: number; modelVersion: string | null } | null> {
  if (!MODEL_API_URL) return null;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), MODEL_API_TIMEOUT_MS);
    const res = await fetch(`${MODEL_API_URL.replace(/\/$/, "")}/predict`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(MODEL_API_TOKEN ? { authorization: `Bearer ${MODEL_API_TOKEN}` } : {}),
      },
      body: JSON.stringify({ sector, material, risk, demand }),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    const mv = Number(j?.market_value_per_kg);
    if (!Number.isFinite(mv) || mv <= 0) return null;
    return { value: mv, modelVersion: j?.model_version ?? null };
  } catch {
    return null; // timeout / network / parse — fall back to the table, never throw
  }
}

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
  const demand = input.demand ?? DEFAULT_DEMAND;
  const material = input.material ?? input.wasteType;

  // 1) LIVE MODEL first. Returns a risk/demand-aware market value (those are model features),
  //    so we do NOT apply the multipliers to it. Null on any failure → fall through to the table.
  const model = await callModel(input.sector, material, input.risk, demand);
  if (model) {
    return { value: model.value, source: "model", modelVersion: model.modelVersion };
  }

  // 2) FALLBACK: precomputed Supabase rows. These are risk/demand-NEUTRAL, so the multipliers
  //    are applied here to keep the UI responsive to those inputs.
  const supabase = await createClient();
  const cols = "market_price_per_kg, price_per_kg, model_version";
  // Granular leaf row (material_type) first; fall back to the coarse bucket row (waste_type).
  // (material_type,area) is unique so maybeSingle() is safe.
  let { data } = await supabase
    .from("price_estimates")
    .select(cols)
    .eq("area", input.sector)
    .eq("material_type", material)
    .maybeSingle();
  if (!data) {
    // Fallback to the bucket's own canonical row, also keyed on material_type (the bucket name
    // seeds a material_type=waste_type row, so this stays unique — unlike a waste_type lookup).
    ({ data } = await supabase
      .from("price_estimates")
      .select(cols)
      .eq("area", input.sector)
      .eq("material_type", input.wasteType)
      .maybeSingle());
  }

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

// Dynamic stops-per-run for a sector, from its historical pickup density. A collection truck's
// trip cost is shared across the stops on the run; denser sectors fit more stops, so per-stop
// logistics is cheaper and the household payout is higher. We use the sector's average pickups
// per ACTIVE collection day (days that actually had a pickup) — stable, and it does NOT punish
// early bookers the way a live pending-count would. Clamped to [MIN, MAX]; any error or no data
// falls back to the static EXPECTED_STOPS_PER_RUN, so the quote can never break.
async function resolveStopsPerRun(sector: string): Promise<number> {
  if (!sector) return EXPECTED_STOPS_PER_RUN;
  try {
    const supabase = await createClient();
    // avg per active day = total pickups / distinct scheduled days, for this sector.
    const { data, error } = await supabase
      .from("pickup_requests")
      .select("scheduled_date")
      .eq("location", sector);
    if (error || !data || data.length === 0) return EXPECTED_STOPS_PER_RUN;
    const distinctDays = new Set(
      data.map((r) => r.scheduled_date).filter((d): d is string => !!d)
    ).size;
    if (distinctDays === 0) return EXPECTED_STOPS_PER_RUN;
    const avgPerDay = data.length / distinctDays;
    // Clamp so a sparse sector can't crater payouts, and a dense one can't zero out logistics.
    return Math.min(STOPS_PER_RUN_MAX, Math.max(STOPS_PER_RUN_MIN, avgPerDay));
  } catch {
    return EXPECTED_STOPS_PER_RUN; // never throw from a quote
  }
}

export async function estimateQuote(input: EstimateInput): Promise<EstimateResult> {
  const distanceKm = resolveDistanceKm(input);
  const [{ value, source, modelVersion }, stopsPerRun] = await Promise.all([
    getMarketValuePerKg(input),
    resolveStopsPerRun(input.sector),
  ]);
  return buildResult(value, distanceKm, input.quantityKg, source, modelVersion, input.boostPct ?? null, stopsPerRun);
}

// Multi-material pickup: quote each stream's market value, then combine into ONE stop quote
// (logistics charged once). Adding a material always adds payout — never reduces it.
export async function estimateMultiQuote(input: MultiEstimateInput): Promise<EstimateResult> {
  const distanceKm = resolveDistanceKm(input);
  const valid = input.entries.filter((e) => e.quantityKg > 0);
  const [priced, stopsPerRun] = await Promise.all([
    Promise.all(
      valid.map(async (e) => {
        const r = await getMarketValuePerKg({ ...input, wasteType: e.wasteType, material: e.material, quantityKg: e.quantityKg });
        return { mvPerKg: r.value, qtyKg: e.quantityKg, source: r.source, modelVersion: r.modelVersion };
      })
    ),
    resolveStopsPerRun(input.sector),
  ]);
  const source = priced[0]?.source ?? "fallback";
  const modelVersion = priced[0]?.modelVersion ?? null;
  return buildMultiResult(
    priced.map((p) => ({ mvPerKg: p.mvPerKg, qtyKg: p.qtyKg })),
    distanceKm,
    source,
    modelVersion,
    input.boostPct ?? null,
    stopsPerRun
  );
}
