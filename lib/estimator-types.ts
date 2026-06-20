/**
 * Typed contract shared by the estimator UIs + pricing. Kept free of server-only imports
 * so client components can import it directly.
 */
import type { WasteType } from "@/lib/types";

export type RiskLevel = "Low" | "Medium" | "High";
export type DemandLevel = "Low" | "Medium" | "High";

export interface EstimateInput {
  wasteType: WasteType; // material
  sector: string; // one of OPERATIONAL_SECTORS (region)
  quantityKg: number; // exact or midpoint of a range
  risk: RiskLevel; // real model input
  demand?: DemandLevel; // optional; defaults to "Medium"
  distanceKm?: number; // resolved from pincode/pin; optional → sector default
  pincode?: string; // raw input (audit / future real routing)
  latlng?: { lat: number; lng: number }; // optional map pin
  boostPct?: number | null; // marketplace payout booster
}

// Multi-material pickup: one stop, several material streams each with its own weight.
// Payout sums each stream's gross household value, then charges logistics ONCE for the stop.
export interface MultiEstimateInput {
  entries: { wasteType: WasteType; quantityKg: number }[];
  sector: string;
  risk: RiskLevel;
  demand?: DemandLevel;
  distanceKm?: number;
  pincode?: string;
  latlng?: { lat: number; lng: number };
  boostPct?: number | null;
}

export interface EstimateResult {
  marketValuePerKg: number;
  logisticsPerKg: number;
  userPayoutPerKg: number; // after commission + logistics, floored at 0
  marginPerKg: number;
  userPayoutTotal: number; // what the household sees
  marginTotal: number;
  belowMinMargin: boolean;
  distanceKm: number;
  source: "model" | "table" | "fallback";
  modelVersion: string | null;
}
