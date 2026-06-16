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
  | "Mixed";

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
  estimated_weight: number;
  status: PickupStatus;
  scheduled_date: string;
  time_slot?: string | null;
  notes: string;
  estimated_price: number | null;
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
  area: AreaType;
  price_per_kg: number;
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

/** A badge resolved against a user's data for rendering. */
export interface ResolvedBadge {
  id: string;
  title: string;
  description: string;
  image_filename: string | null;
  unlocked: boolean;
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
