import { describe, expect, it } from "vitest";
import { evaluateBadges, isBadgeUnlocked } from "../lib/badges";
import type { Badge } from "../lib/types";

const profile = {
  green_credits: 0,
  pickups_completed: 0,
  kg_recycled: 0,
};

const signals = {
  manualBadgeIds: [] as string[],
  distinctCategories: 0,
  kgByMaterial: {} as Record<string, number>,
};

const badge = (overrides: Partial<Badge>): Badge => ({
  id: "b1",
  title: "First Pickup",
  description: "Complete your first pickup.",
  image_filename: null,
  category: "milestone",
  unlock_type: "pickups",
  unlock_threshold: 1,
  sort_order: 1,
  ...overrides,
});

describe("badge unlocks", () => {
  it("unlocks the first pickup badge at one completed pickup", () => {
    const firstPickup = badge({});

    expect(isBadgeUnlocked(firstPickup, profile, signals)).toBe(false);
    expect(isBadgeUnlocked(firstPickup, { ...profile, pickups_completed: 1 }, signals)).toBe(true);
  });

  it("uses material-specific kilograms for material badges", () => {
    const plasticBadge = badge({ id: "b8", unlock_type: "kg", unlock_threshold: 10 });

    expect(
      isBadgeUnlocked(plasticBadge, { ...profile, kg_recycled: 100 }, { ...signals, kgByMaterial: { Paper: 20 } })
    ).toBe(false);
    expect(isBadgeUnlocked(plasticBadge, profile, { ...signals, kgByMaterial: { Plastic: 10 } })).toBe(true);
  });

  it("resolves measurable badges as in-progress before they are earned", () => {
    expect(evaluateBadges([badge({ unlock_threshold: 4 })], { ...profile, pickups_completed: 2 }, signals)[0]).toMatchObject({
      unlocked: false,
      state: "in-progress",
      current: 2,
      target: 4,
      pct: 50,
    });
  });

  it("keeps badges without tracked signals locked", () => {
    expect(evaluateBadges([badge({ unlock_type: "streak", unlock_threshold: 7 })], profile, signals)[0]).toMatchObject({
      unlocked: false,
      state: "locked",
      current: 0,
      target: 7,
      pct: 0,
    });
  });
});
