/**
 * Badge unlock computation — pure & server-safe.
 *
 * Unlock state is derived live from a user's profile + cheap signals wherever a real
 * signal exists (credits, pickups, per-material kg, distinct categories, manual grants).
 * streak / referral / quiz badges have no tracked signal yet (Phase 2) and stay locked.
 */
import type { Badge, ResolvedBadge, BadgeState } from "@/lib/types";

export interface BadgeSignals {
  /** Badge ids granted to the user via the user_badges table (manual/campaign grants). */
  manualBadgeIds: string[];
  /** Distinct waste_type count across the user's completed pickups. */
  distinctCategories: number;
  /** Total kg per waste_type across the user's completed pickups. */
  kgByMaterial: Record<string, number>;
}

type ProfileLike = {
  green_credits: number;
  pickups_completed: number;
  kg_recycled: number;
};

// Per-material kg badges → the waste_type they track.
const KG_BADGE_MATERIAL: Record<string, string> = {
  b7: "Paper",
  b8: "Plastic",
  b9: "Metal",
};

export function isBadgeUnlocked(badge: Badge, profile: ProfileLike, signals: BadgeSignals): boolean {
  const threshold = badge.unlock_threshold ?? Infinity;
  switch (badge.unlock_type) {
    case "credits":
      // Forest Elder (b14, threshold 2500) is equivalent to Level 19 — stays consistent with lib/gamification.
      return profile.green_credits >= threshold;
    case "pickups":
      return profile.pickups_completed >= threshold;
    case "kg": {
      const material = KG_BADGE_MATERIAL[badge.id];
      const kg = material ? signals.kgByMaterial[material] ?? 0 : profile.kg_recycled;
      return kg >= threshold;
    }
    case "categories":
      return signals.distinctCategories >= threshold;
    case "manual":
      return signals.manualBadgeIds.includes(badge.id);
    // No signal tracked yet (Phase 2). ponytail: locked until streak/referral/quiz tracking exists.
    case "streak":
    case "referral":
    case "quiz":
    default:
      return false;
  }
}

// Axes that carry a real, measurable signal → eligible for "in-progress".
// streak/referral/quiz have no tracked signal yet (Phase 2) → stay "locked".
const MEASURABLE: Badge["unlock_type"][] = ["credits", "pickups", "kg", "categories"];

/** The user's current value on a badge's axis (for the "X / Y to go" progress UI). */
function badgeCurrent(badge: Badge, profile: ProfileLike, signals: BadgeSignals): number {
  switch (badge.unlock_type) {
    case "credits":
      return profile.green_credits;
    case "pickups":
      return profile.pickups_completed;
    case "kg": {
      const material = KG_BADGE_MATERIAL[badge.id];
      return material ? signals.kgByMaterial[material] ?? 0 : profile.kg_recycled;
    }
    case "categories":
      return signals.distinctCategories;
    case "manual":
      return signals.manualBadgeIds.includes(badge.id) ? 1 : 0;
    default:
      return 0; // streak/referral/quiz — no signal yet
  }
}

/**
 * Single source of truth: resolve every badge to {state, current, target, pct} from real data.
 * The profile grid, dashboard slice, and unlock toast all read from this — `unlocked` is never a literal.
 */
export function evaluateBadges(
  badges: Badge[],
  profile: ProfileLike,
  signals: BadgeSignals
): ResolvedBadge[] {
  return badges.map((b) => {
    const unlocked = isBadgeUnlocked(b, profile, signals);
    const current = badgeCurrent(b, profile, signals);
    const target = b.unlock_threshold ?? Infinity;
    const measurable = MEASURABLE.includes(b.unlock_type);
    const state: BadgeState = unlocked ? "earned" : measurable ? "in-progress" : "locked";
    const pct = unlocked ? 100 : Number.isFinite(target) && target > 0
      ? Math.min(100, Math.round((current / target) * 100))
      : 0;
    return {
      id: b.id,
      title: b.title,
      description: b.description,
      image_filename: b.image_filename,
      unlocked,
      state,
      current,
      target,
      pct,
    };
  });
}
