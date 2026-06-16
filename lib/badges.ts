/**
 * Badge unlock computation — pure & server-safe.
 *
 * Unlock state is derived live from a user's profile + cheap signals wherever a real
 * signal exists (credits, pickups, per-material kg, distinct categories, manual grants).
 * streak / referral / quiz badges have no tracked signal yet (Phase 2) and stay locked.
 */
import type { Badge } from "@/lib/types";

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

export function computeBadgeState(
  badges: Badge[],
  profile: ProfileLike,
  signals: BadgeSignals
): Record<string, { unlocked: boolean }> {
  const out: Record<string, { unlocked: boolean }> = {};
  for (const b of badges) out[b.id] = { unlocked: isBadgeUnlocked(b, profile, signals) };
  return out;
}
