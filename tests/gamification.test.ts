import { describe, expect, it } from "vitest";
import { getLevelNumber, getNextTier, getTier, getTierIconFilename } from "../lib/gamification";

describe("gamification tiers", () => {
  it("keeps credits just below, at, and above a tier boundary in the right level", () => {
    expect(getTier(1319)).toMatchObject({ rank: "Blooming Tree", level: 14 });
    expect(getTier(1320)).toMatchObject({ rank: "Fruit Bearer", level: 15 });
    expect(getTier(1321)).toMatchObject({ rank: "Fruit Bearer", level: 15 });
  });

  it("returns the first tier for negative credits", () => {
    expect(getLevelNumber(-1)).toBe(1);
    expect(getTier(-1).rank).toBe("Seed");
  });

  it("returns no next tier at the maximum tier", () => {
    expect(getNextTier(3000)).toBeNull();
  });

  it("falls back to the seed icon for an unknown rank", () => {
    expect(getTierIconFilename("Unknown")).toBe("Level01Seed.png");
  });
});
