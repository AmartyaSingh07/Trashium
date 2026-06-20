/**
 * Pure pricing math — safe to import from client OR server.
 * (lib/pricing.ts pulls in the server Supabase client, so it can't be imported by client code.)
 *
 * The estimate functions below mirror /ml/pricing.py exactly (the single source of truth for
 * the money formulas). Keep them in lock-step with that file.
 */
import {
  COMMISSION,
  LOGISTICS_BASE,
  LOGISTICS_PER_KM,
  MIN_MARGIN_PER_KG,
  EXPECTED_STOPS_PER_RUN,
} from "@/lib/pricing-constants";
import type { EstimateResult } from "@/lib/estimator-types";

const r2 = (n: number) => +n.toFixed(2);

/** Apply a one-time payout boost (percent) to a household payout. Returns base unchanged when no boost. */
export function applyBoost(basePrice: number, pct: number | null | undefined): number {
  if (!pct) return basePrice;
  return +(basePrice * (1 + pct / 100)).toFixed(2);
}

/**
 * Serve-time logistics cost (INR) for ONE stop on a multi-stop collection run.
 * The full trip cost (base + per-km) is shared across the expected stops per run, so a single
 * household isn't charged the whole solo-trip cost (which zeroed out small/low-value loads).
 *
 * `stopsPerRun` is the number of stops the trip cost is divided across. It defaults to the static
 * EXPECTED_STOPS_PER_RUN, but estimate.ts passes a sector-specific value derived from that sector's
 * historical pickup density (denser sector → more stops → cheaper per-stop logistics → higher
 * payout). Always clamp it upstream so a sparse/empty sector can't crater payouts.
 * Mirrors /ml/pricing.py estimate_logistics_cost — keep in sync (TODO(ml-logistics-sync)).
 */
export function estimateLogisticsCost(distanceKm: number, stopsPerRun: number = EXPECTED_STOPS_PER_RUN): number {
  const stops = stopsPerRun > 0 ? stopsPerRun : EXPECTED_STOPS_PER_RUN;
  return (LOGISTICS_BASE + LOGISTICS_PER_KM * distanceKm) / stops;
}

export function logisticsPerKg(distanceKm: number, qtyKg: number, stopsPerRun: number = EXPECTED_STOPS_PER_RUN): number {
  if (!qtyKg || qtyKg <= 0) return 0;
  return estimateLogisticsCost(distanceKm, stopsPerRun) / qtyKg;
}

/** market_value/kg × (1 − commission) − logistics/kg. Not floored here (buildResult floors). */
export function userPayoutPerKg(mvPerKg: number, logPerKg: number): number {
  return mvPerKg * (1 - COMMISSION) - logPerKg;
}

export function marginPerKg(mvPerKg: number): number {
  return COMMISSION * mvPerKg;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance (km). Underestimates road distance — callers apply ROAD_FACTOR. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Multi-material quote for ONE pickup stop. Each stream's gross household value
 * (mv/kg × (1−commission) × kg) is summed, then the single per-stop logistics cost is
 * subtracted ONCE (not per material — that would over-charge logistics). Floored at 0,
 * then boosted. With a single entry this is identical to buildResult().
 */
export function buildMultiResult(
  entries: { mvPerKg: number; qtyKg: number }[],
  distanceKm: number,
  source: EstimateResult["source"],
  modelVersion: string | null,
  boostPct: number | null | undefined,
  stopsPerRun: number = EXPECTED_STOPS_PER_RUN
): EstimateResult {
  const totalKg = entries.reduce((s, e) => s + e.qtyKg, 0);
  const stopCost = estimateLogisticsCost(distanceKm, stopsPerRun); // one trip cost for the whole stop
  const grossPayout = entries.reduce((s, e) => s + e.mvPerKg * (1 - COMMISSION) * e.qtyKg, 0);
  const rawPayoutTotal = Math.max(grossPayout - stopCost, 0); // never negative
  const payoutTotal = applyBoost(rawPayoutTotal, boostPct);
  const marginTotal = entries.reduce((s, e) => s + COMMISSION * e.mvPerKg * e.qtyKg, 0);
  const weightedMv = totalKg > 0 ? entries.reduce((s, e) => s + e.mvPerKg * e.qtyKg, 0) / totalKg : 0;
  return {
    marketValuePerKg: r2(weightedMv),
    logisticsPerKg: r2(totalKg > 0 ? stopCost / totalKg : 0),
    userPayoutPerKg: r2(totalKg > 0 ? payoutTotal / totalKg : 0),
    marginPerKg: r2(COMMISSION * weightedMv),
    userPayoutTotal: r2(payoutTotal),
    marginTotal: r2(marginTotal),
    belowMinMargin: COMMISSION * weightedMv < MIN_MARGIN_PER_KG,
    distanceKm: r2(distanceKm),
    source,
    modelVersion,
  };
}

/** Assemble the full typed quote from a market value + this pickup's logistics. Mirrors pricing.py quote(). */
export function buildResult(
  mvPerKg: number,
  distanceKm: number,
  qtyKg: number,
  source: EstimateResult["source"],
  modelVersion: string | null,
  boostPct: number | null | undefined,
  stopsPerRun: number = EXPECTED_STOPS_PER_RUN,
): EstimateResult {
  const lpk = logisticsPerKg(distanceKm, qtyKg, stopsPerRun);
  const rawPayoutPerKg = Math.max(userPayoutPerKg(mvPerKg, lpk), 0); // never quote negative
  const payoutPerKg = applyBoost(rawPayoutPerKg, boostPct); // marketplace booster, if any
  const mgnk = marginPerKg(mvPerKg);
  return {
    marketValuePerKg: r2(mvPerKg),
    logisticsPerKg: r2(lpk),
    userPayoutPerKg: r2(payoutPerKg),
    marginPerKg: r2(mgnk),
    userPayoutTotal: r2(payoutPerKg * qtyKg),
    marginTotal: r2(mgnk * qtyKg),
    belowMinMargin: mgnk < MIN_MARGIN_PER_KG,
    distanceKm: r2(distanceKm),
    source,
    modelVersion,
  };
}
