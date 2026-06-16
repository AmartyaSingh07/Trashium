"use client";

import { TRASHIUM_EVALUATION_TIERS, getTierIconFilename } from "@/lib/gamification";

// Re-exported for existing importers (e.g. dashboard-content). Canonical source: lib/gamification.ts
export { TRASHIUM_EVALUATION_TIERS };

interface EcoLevelBadgeProps {
  greenCredits: number;
}

export const getTierIcon = (rank: string) => {
  if (rank === "Seed") return "🌱";
  if (rank === "Sprout") return "🌱";
  if (rank === "Seedling") return "🌱";
  if (rank === "Rootling") return "🌱";
  if (rank === "Green Shoot") return "🌿";
  if (rank === "Rooted Growth") return "🌿";
  if (rank === "Sapling") return "🌿";
  if (rank === "Young Sapling") return "🌿";
  if (rank === "Woodland Sapling") return "🌿";
  if (rank === "Young Tree") return "🌳";
  if (rank === "Growing Tree") return "🌳";
  if (rank === "Strong Tree") return "🌳";
  if (rank === "Flourishing Tree") return "🌳";
  if (rank === "Blooming Tree") return "🌳";
  if (rank === "Fruit Bearer") return "🌳";
  if (rank === "Ancient Tree") return "🌲";
  if (rank === "Grove Guardian") return "🌲";
  if (rank === "Forest Keeper") return "🏞️";
  if (rank === "Forest Elder") return "🏞️";
  if (rank === "Tree of Life") return "🌍";
  return "🌱";
};

export const getTierIconUrl = (rank: string) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fqbjjcbrxrokvdwkydze.supabase.co";
  const cdnBase = `${supabaseUrl}/storage/v1/object/public/gamification-levels`;
  return `${cdnBase}/${getTierIconFilename(rank)}`;
};

export default function EcoLevelBadge({ greenCredits }: EcoLevelBadgeProps) {
  const currentPoints = greenCredits;
  const activeTier = [...TRASHIUM_EVALUATION_TIERS].reverse().find(t => currentPoints >= t.minPoints) || TRASHIUM_EVALUATION_TIERS[0];
  const nextTierIndex = TRASHIUM_EVALUATION_TIERS.findIndex(t => t.rank === activeTier.rank) + 1;
  const nextTier = nextTierIndex < TRASHIUM_EVALUATION_TIERS.length ? TRASHIUM_EVALUATION_TIERS[nextTierIndex] : null;

  const progress = nextTier
    ? ((currentPoints - activeTier.minPoints) /
        (nextTier.minPoints - activeTier.minPoints)) *
      100
    : 100;

  const icon = getTierIcon(activeTier.rank);
  const iconUrl = getTierIconUrl(activeTier.rank);

  return (
    <div className="t-glass-card p-6 relative overflow-hidden">
      <div className="flex items-center gap-4 mb-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-terra/10 overflow-hidden border border-[#D4C5B0]/50 shadow-inner relative animate-float">
          {/* Supabase PNG symbol */}
          <img 
            src={iconUrl} 
            alt={activeTier.rank} 
            crossOrigin="anonymous"
            className="w-full h-full object-contain p-2 filter drop-shadow-[0_2px_4px_rgba(44,31,20,0.15)]"
          />
        </div>
        <div>
          <p className="t-label text-smoke">
            Your Eco-Level
          </p>
          <h3 className="font-[family-name:var(--font-syne)] text-xl font-bold text-bark">
            {activeTier.rank}
          </h3>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-3">
        <div className="flex justify-between text-xs text-smoke font-[family-name:var(--font-dm)]">
          <span>{greenCredits.toLocaleString()} credits</span>
          {nextTier ? (
            <span>{nextTier.minPoints.toLocaleString()} to {nextTier.rank}</span>
          ) : (
            <span className="text-terra font-semibold">Max Level ✨</span>
          )}
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-sand/35">
          <div
            className="h-full rounded-full bg-gradient-to-r from-terra to-sage transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        {nextTier && (
          <p className="text-xs text-smoke/80 font-[family-name:var(--font-dm)]">
            {(nextTier.minPoints - greenCredits).toLocaleString()} credits until{" "}
            <span className="font-semibold text-bark">{nextTier.rank}</span>
          </p>
        )}
      </div>
    </div>
  );
}
