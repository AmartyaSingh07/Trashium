export type UserRole = "household" | "collector" | "admin";

export type EcoLevelName =
  | "Seedling"
  | "Sapling"
  | "Young Tree"
  | "Urban Forest"
  | "Earth Guardian";

export type WasteType =
  | "Plastic"
  | "Paper"
  | "Glass"
  | "Metal"
  | "E-Waste"
  | "Organic"
  | "Mixed"
  | "Battery"; // pricing bucket for all battery leaf types; rates seeded from E-Waste (TODO(ml-battery))

export type PickupStatus =
  | "pending"
  | "confirmed"
  | "collected"
  | "processed"
  | "cancelled";

export type AreaType = "Urban" | "Suburban" | "Rural" | "Rishra" | "Howrah" | "Shyamnagar" | "Tarakeswar" | "Hugli-Chinsura";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  eco_level: EcoLevelName;
  green_credits: number;
  kg_recycled: number;
  co2_saved: number;
  pickups_completed: number;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  pending_payout_boost_pct?: number | null; // Module F: one pending boost (percent) for next pickup
}

export interface PickupRequest {
  id: string;
  user_id: string;
  full_name: string;
  location: string;
  address: string;
  waste_type: WasteType;
  waste_items?: string[] | null; // granular leaf materials chosen at booking (e.g. ["Copper"]); null for legacy rows
  estimated_weight: number;
  status: PickupStatus;
  scheduled_date: string;
  time_slot?: string | null;
  notes: string;
  estimated_price: number | null;
  payout_override?: number | null; // admin-set final payout; authoritative = payout_override ?? estimated_price
  override_by?: string | null;
  override_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlobalImpact {
  id: number;
  total_kg_recycled: number;
  total_co2_saved: number;
  total_households: number;
  total_green_credits: number;
  updated_at: string;
}

export interface PriceEstimate {
  id: string;
  waste_type: WasteType;
  material_type?: string | null; // granular leaf material (e.g. "Copper"); = waste_type for bucket rows
  area: AreaType;
  price_per_kg: number;
  logistics_per_kg: number | null;
  market_price_per_kg: number | null;
  profit_per_kg: number | null;
  model_version: string | null;
  created_at: string;
}

export type BadgeCategory = "milestone" | "streak" | "material" | "social" | "special";
export type BadgeUnlockType =
  | "credits"
  | "pickups"
  | "kg"
  | "categories"
  | "streak"
  | "referral"
  | "quiz"
  | "manual";

export interface Badge {
  id: string;
  title: string;
  description: string;
  image_filename: string | null;
  category: BadgeCategory;
  unlock_type: BadgeUnlockType;
  unlock_threshold: number | null;
  sort_order: number;
  created_at?: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  awarded_at: string;
}

export type BadgeState = "earned" | "in-progress" | "locked";

/** A badge resolved against a user's data for rendering. */
export interface ResolvedBadge {
  id: string;
  title: string;
  description: string;
  image_filename: string | null;
  unlocked: boolean;
  /** earned = unlocked; in-progress = measurable signal, not yet met; locked = no signal/criterion unmet. */
  state: BadgeState;
  /** User's current value on this badge's axis (credits/pickups/kg/categories). */
  current: number;
  /** Threshold to earn (Infinity for badges with no numeric target, e.g. manual grants). */
  target: number;
  /** 0–100 progress toward target. */
  pct: number;
}

export type MarketplaceTier = "seedling" | "sapling" | "forest" | "perk" | "legendary";
export type RedemptionStatus = "pending" | "dispatched" | "delivered" | "cancelled";

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  tier: MarketplaceTier;
  cost_credits: number;
  image_filename: string | null;
  level_requirement: number | null;
  badge_requirement: string | null;
  stock: number | null;
  is_active: boolean;
  perk_type: string | null;
  perk_value: number | null;
  sort_order: number;
  created_at?: string;
}

export interface RedemptionOrder {
  id: string;
  user_id: string;
  item_id: string;
  item_name: string;
  cost_at_redemption: number;
  status: RedemptionStatus;
  shipping_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EcoLevel {
  name: EcoLevelName;
  minCredits: number;
  icon: string;
  color: string;
}

/** @deprecated Stale 5-tier system. Use the canonical 20-tier helpers in `lib/gamification.ts`. */
export const ECO_LEVELS: EcoLevel[] = [
  { name: "Seedling", minCredits: 0, icon: "🌱", color: "text-green-400" },
  { name: "Sapling", minCredits: 100, icon: "🌿", color: "text-green-500" },
  { name: "Young Tree", minCredits: 500, icon: "🌳", color: "text-emerald-500" },
  { name: "Urban Forest", minCredits: 1500, icon: "🏞️", color: "text-emerald-600" },
  { name: "Earth Guardian", minCredits: 5000, icon: "🌍", color: "text-teal-600" },
];

/** @deprecated Use `getTier`/`getLevelNumber` from `lib/gamification.ts`. */
export function getEcoLevel(credits: number): EcoLevel {
  let current = ECO_LEVELS[0];
  for (const level of ECO_LEVELS) {
    if (credits >= level.minCredits) {
      current = level;
    }
  }
  return current;
}

/** @deprecated Use `getNextTier` from `lib/gamification.ts`. */
export function getNextEcoLevel(credits: number): EcoLevel | null {
  for (const level of ECO_LEVELS) {
    if (credits < level.minCredits) {
      return level;
    }
  }
  return null;
}

/**
 * One row from the `get_household_leaderboard()` RPC (households only, no email).
 * `sector` is the raw most-frequent pickup location (e.g. "Rishra, Kolkata") or null
 * when the household has no completed pickup; the UI normalizes it to an operational sector.
 * Numeric columns arrive as strings from PostgREST — coerce with Number() at use sites.
 */
export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  sector: string | null;
  green_credits: number | string;
  kg_recycled: number | string;
}

/** Hydration payload from the `get_daily_status()` RPC (today's row + streak state). */
export interface DailyStatus {
  ok: boolean;
  activity_date: string;
  logged_in: boolean;
  segregated: boolean;
  quizzes_correct: number;
  quiz_strikes: number;
  perfect_day: boolean;
  credits_earned: number;
  current_streak: number;
  longest_streak: number;
  streak_freezes: number;
  weekly_active_days: number;
  claimed_milestones: number[];
}

/** Return shape from the `log_daily_action(p_action)` RPC — the authoritative result of one action. */
export interface DailyActionResult {
  ok: boolean;
  reason?: string;
  awarded?: number;
  base?: number;
  multiplier?: number;
  current_streak?: number;
  longest_streak?: number;
  perfect_day?: boolean;
  freezes?: number;
  freeze_used?: boolean;
  chest?: { milestone: number; reward: number; freeze: number } | null;
  green_credits?: number;
  caps?: { quizzes_correct: number; quiz_strikes: number; segregated: boolean; logged_in: boolean };
  weekly_active_days?: number;
}
