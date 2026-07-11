/**
 * Pricing constants — mirror of /ml/config.py so the app never drifts from the model.
 * Client-safe (no imports). Business config, not invented prices.
 */
export const COMMISSION = 0.15;
export const LOGISTICS_BASE = 111.06;
export const LOGISTICS_PER_KM = 4.8;
export const MIN_MARGIN_PER_KG = 0.5;

// A collection run visits multiple households; the fixed trip cost (LOGISTICS_BASE) is one truck
// trip's cost, shared across the stops on that run — NOT charged in full to a single household.
// Dividing by this is what stops small/low-value loads quoting ₹0. Higher = cheaper per-stop
// logistics. Tune to ops reality. TODO(ops-calibrate). Keep in sync with /ml/pricing.py if synced.
export const EXPECTED_STOPS_PER_RUN = 8;

// Dynamic per-sector stops-per-run: estimate.ts derives a sector's expected stops from its
// historical pickup density and clamps it to [MIN, MAX] so a sparse/empty sector can't crater
// payouts (low stops → high per-stop logistics) and a dense one can't zero out logistics. The
// static EXPECTED_STOPS_PER_RUN is the fallback when there's no data / on any query error.
export const STOPS_PER_RUN_MIN = 3;
export const STOPS_PER_RUN_MAX = 12;

export const DEFAULT_DEMAND = "Medium" as const;

export const RISK_MULTIPLIER = { Low: 1.0, Medium: 0.92, High: 0.82 } as const;
export const DEMAND_MULTIPLIER = { Low: 0.95, Medium: 1.0, High: 1.07 } as const;

// Live ML model service (FastAPI, hosted off-Vercel — Railway/Render/Fly). When set, estimate.ts
// calls it first and falls back to the Supabase price_estimates rows on any error/timeout, so the
// site never breaks if the model is down. Leave unset to use the precomputed table only.
export const MODEL_API_URL = process.env.MODEL_API_URL ?? "";
export const MODEL_API_TOKEN = process.env.MODEL_API_TOKEN ?? "";
export const MODEL_API_TIMEOUT_MS = Number(process.env.MODEL_API_TIMEOUT_MS ?? 2000);

// haversine (straight-line) → approx road distance. TODO(distance-matrix): swap in OSRM/routing.
export const ROAD_FACTOR = 1.3;

// Central collection depot for the Hooghly belt (~Konnagar/Hindmotor). TODO(hub-coords): confirm real depot.
export const HUB_LATLNG = { lat: 22.68, lng: 88.34 } as const;

// Per-sector hub distance (km) fallback when no pincode/pin given.
// = haversine(sector_centre, HUB_LATLNG) × ROAD_FACTOR, rounded (already road-approx).
export const SECTOR_HUB_DISTANCE_KM: Record<string, number> = {
  Rishra: 6.9,
  Howrah: 15.9,
  Shyamnagar: 23.8,
  Tarakeswar: 52.3,
  "Hugli-Chinsura": 33.9,
};

// ponytail: SECTOR_CENTRE_LATLNG omitted — only needed for the map-pin haversine, which isn't
// wired yet. Add it back when the "drop a pin" map lands. TODO(distance-matrix).
