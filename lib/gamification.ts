/**
 * Canonical Trashium eco-level system — single source of truth.
 *
 * 20 tiers, Seed (Level 1, 0 credits) → Tree of Life (Level 20, 3000 credits).
 * Levels are computed from `green_credits`, never stored. Used by the dashboard
 * eco-level badge, the profile page, badges, and the marketplace level gate.
 *
 * Pure (no React) so it's safe to import from server code, client code, and helpers.
 */

export interface Tier {
  rank: string;
  level: number; // 1..20
  minPoints: number;
}

export const TRASHIUM_EVALUATION_TIERS: Tier[] = [
  { rank: "Seed", level: 1, minPoints: 0 },
  { rank: "Sprout", level: 2, minPoints: 15 },
  { rank: "Seedling", level: 3, minPoints: 40 },
  { rank: "Rootling", level: 4, minPoints: 75 },
  { rank: "Green Shoot", level: 5, minPoints: 120 },
  { rank: "Rooted Growth", level: 6, minPoints: 180 },
  { rank: "Sapling", level: 7, minPoints: 250 },
  { rank: "Young Sapling", level: 8, minPoints: 330 },
  { rank: "Woodland Sapling", level: 9, minPoints: 420 },
  { rank: "Young Tree", level: 10, minPoints: 520 },
  { rank: "Growing Tree", level: 11, minPoints: 640 },
  { rank: "Strong Tree", level: 12, minPoints: 780 },
  { rank: "Flourishing Tree", level: 13, minPoints: 940 },
  { rank: "Blooming Tree", level: 14, minPoints: 1120 },
  { rank: "Fruit Bearer", level: 15, minPoints: 1320 },
  { rank: "Ancient Tree", level: 16, minPoints: 1550 },
  { rank: "Grove Guardian", level: 17, minPoints: 1820 },
  { rank: "Forest Keeper", level: 18, minPoints: 2130 },
  { rank: "Forest Elder", level: 19, minPoints: 2500 },
  { rank: "Tree of Life", level: 20, minPoints: 3000 },
];

// Level-icon filenames in the `gamification-levels` storage bucket. Filename only — callers build the URL.
const TIER_ICON_FILENAMES: Record<string, string> = {
  Seed: "Level01Seed.png",
  Sprout: "Level02Sprout.png",
  Seedling: "Level03Seedling.png",
  Rootling: "Level04Rootling.png",
  "Green Shoot": "Level05GreenShoot.png",
  "Rooted Growth": "Level06RootedGrowth.png",
  Sapling: "Level07Sapling.png",
  "Young Sapling": "Level08YoungSapling.png",
  "Woodland Sapling": "Level09WoodlandSapling.png",
  "Young Tree": "Level10YoungTree.png",
  "Growing Tree": "Level11GrowingTree.png",
  "Strong Tree": "Level12StrongTree.png",
  "Flourishing Tree": "Level13FlourishingTree.png",
  "Blooming Tree": "Level14BloomingTree.png",
  "Fruit Bearer": "Level15FruitBearer.png",
  "Ancient Tree": "Level16AncientTree.png",
  "Grove Guardian": "Level17GroveGuardian.png",
  "Forest Keeper": "Level18ForestKeeper.png",
  "Forest Elder": "Level19ForestElder.png",
  "Tree of Life": "Level20TreeOfLife.png",
};

/** The user's current tier for a given credit balance. */
export function getTier(credits: number): Tier {
  return (
    [...TRASHIUM_EVALUATION_TIERS].reverse().find((t) => credits >= t.minPoints) ??
    TRASHIUM_EVALUATION_TIERS[0]
  );
}

/** The next tier up, or null if already at max. */
export function getNextTier(credits: number): Tier | null {
  const idx = TRASHIUM_EVALUATION_TIERS.findIndex((t) => t.rank === getTier(credits).rank);
  return idx + 1 < TRASHIUM_EVALUATION_TIERS.length ? TRASHIUM_EVALUATION_TIERS[idx + 1] : null;
}

/** Numeric level (1..20) for a given credit balance. */
export function getLevelNumber(credits: number): number {
  return getTier(credits).level;
}

export function getTierByRank(rank: string): Tier | undefined {
  return TRASHIUM_EVALUATION_TIERS.find((t) => t.rank === rank);
}

/** Icon filename (no URL) for a tier rank, falling back to the Seed icon. */
export function getTierIconFilename(rank: string): string {
  return TIER_ICON_FILENAMES[rank] ?? "Level01Seed.png";
}

// Invariant (verified by build + acceptance): getLevelNumber(2500) === 19, getLevelNumber(3000) === 20.
