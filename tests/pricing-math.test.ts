import { describe, expect, it } from "vitest";
import { applyBoost, buildMultiResult, buildResult, estimateLogisticsCost, logisticsPerKg } from "../lib/pricing-math";

describe("pricing math", () => {
  it("builds a deterministic single-material payout quote", () => {
    expect(buildResult(20, 8, 10, "fallback", "test-model", null, 4)).toMatchObject({
      marketValuePerKg: 20,
      logisticsPerKg: 3.74,
      userPayoutPerKg: 13.26,
      marginPerKg: 3,
      userPayoutTotal: 132.63,
      marginTotal: 30,
      belowMinMargin: false,
      distanceKm: 8,
      source: "fallback",
      modelVersion: "test-model",
    });
  });

  it("returns zero per-kg logistics for zero weight", () => {
    expect(logisticsPerKg(8, 0)).toBe(0);
  });

  it("falls back to the default stop count when stops per run is invalid", () => {
    expect(estimateLogisticsCost(8, 0)).toBe(estimateLogisticsCost(8));
  });

  it("floors empty multi-material quotes at zero", () => {
    expect(buildMultiResult([], 5, "fallback", null, null)).toMatchObject({
      marketValuePerKg: 0,
      logisticsPerKg: 0,
      userPayoutPerKg: 0,
      userPayoutTotal: 0,
      marginTotal: 0,
      distanceKm: 5,
    });
  });

  it("applies payout boosts as percentages", () => {
    expect(applyBoost(100, 15)).toBe(115);
    expect(applyBoost(100, null)).toBe(100);
  });
});
