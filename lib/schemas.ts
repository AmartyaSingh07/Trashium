import { z } from "zod";
import { OPERATIONAL_SECTORS } from "@/lib/constants";

/**
 * Client-side input schemas (defense-in-depth + form UX).
 *
 * IMPORTANT: these validate INPUT SHAPE only. They are NOT the security boundary
 * — a user can bypass the client and call PostgREST/RPC directly, so real
 * enforcement stays with RLS + DB CHECK constraints + the RPCs' internal checks
 * (see SECURITY_AUDIT_PRELAUNCH.md). Nothing here alters the frozen ML estimator
 * or the pickup quote contract; the pickup schema only guards the values that the
 * submit handler already required, plus bounded lengths.
 *
 * Auth messages are i18n KEYS in the `auth` namespace — forms resolve them via
 * `t(issue.message)`. The pickup form is English-only (like the rest of that
 * modal), so its messages are plain strings.
 */

// ── Auth ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email("invalidEmail"),
  password: z.string().min(1, "passwordRequired"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    full_name: z.string().trim().min(1, "nameRequired"),
    email: z.string().email("invalidEmail"),
    password: z.string().min(6, "passwordTooShort"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "passwordsNoMatch",
    path: ["confirmPassword"],
  });
export type SignupInput = z.infer<typeof signupSchema>;

// ── Schedule pickup (shape-only guard; quote logic untouched) ────────────────
const isOperationalSector = (v: string): boolean =>
  (OPERATIONAL_SECTORS as readonly string[]).includes(v);

export const schedulePickupSchema = z.object({
  waste_items: z.array(z.string()).min(1, "Select at least one material."),
  weight: z
    .number()
    .positive("Add a weight for each material and fill in all required fields."),
  location: z
    .string()
    .refine(isOperationalSector, "Choose a valid location."),
  scheduled_date: z.string().min(1, "Pick a preferred date."),
  time_slot: z.string().min(1, "Choose a collection time."),
  // Optional free-text — bounded to guard against oversized payloads.
  address: z.string().max(500, "Address is too long.").optional(),
  notes: z.string().max(1000, "Notes are too long.").optional(),
  // Pincode is a soft hint for logistics; blank is allowed and any non-empty
  // value is passed through untouched (behaviour unchanged) — only length-capped.
  pincode: z.string().max(12, "Pincode is too long.").optional(),
});
export type SchedulePickupInput = z.infer<typeof schedulePickupSchema>;

// ── Marketplace redemption (shape-only guard; RPC enforces the real rules) ────
// The only input is the selected item's UUID, passed to the
// `redeem_marketplace_item` RPC. Validating the shape here is defense-in-depth
// + a guard against malformed calls; active/stock/level/badge/credits checks all
// live inside the SECURITY DEFINER RPC. Message is an i18n KEY in the
// `marketplace` namespace (that flow is fully localized).
export const redeemItemSchema = z.object({
  item_id: z.string().uuid("invalidItem"),
});
export type RedeemItemInput = z.infer<typeof redeemItemSchema>;

// ── Marketplace admin: item create/update (admin-only, English-only) ──────────
// Validates the SHAPE of the payload written to `marketplace_items`. The DB CHECK
// constraints + FKs stay the real boundary (cost_credits >= 0, badge_requirement
// FK → badges.id, etc.). Numeric/nullable fields mirror the admin form: blanks
// become null, level maps to the 1–20 tier index. Messages are plain strings
// because the admin panel is not localized.
export const marketplaceItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120, "Name is too long."),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(500, "Description is too long."),
  tier: z.enum(["seedling", "sapling", "forest", "perk", "legendary"]),
  cost_credits: z
    .number()
    .int("Cost must be a whole number of credits.")
    .min(0, "Cost can't be negative.")
    .max(10_000_000, "Cost is too high."),
  image_filename: z.string().trim().max(200, "Image filename is too long.").nullable(),
  level_requirement: z
    .number()
    .int("Level requirement must be a whole number.")
    .min(1, "Level requirement must be between 1 and 20.")
    .max(20, "Level requirement must be between 1 and 20.")
    .nullable(),
  badge_requirement: z.string().trim().max(40, "Badge id is too long.").nullable(),
  stock: z
    .number()
    .int("Stock must be a whole number.")
    .min(0, "Stock can't be negative.")
    .max(10_000_000, "Stock is too high.")
    .nullable(),
  perk_type: z.string().trim().max(60, "Perk type is too long.").nullable(),
  perk_value: z.number().finite("Perk value must be a number.").nullable(),
  is_active: z.boolean(),
});
export type MarketplaceItemInput = z.infer<typeof marketplaceItemSchema>;

// ── Marketplace admin: manual badge award ────────────────────────────────────
// user_id is a profile UUID; badge_id is a short catalog id ('b1'..'b15'), not a
// UUID. Both come from dropdowns; this is a shape guard only.
export const awardBadgeSchema = z.object({
  user_id: z.string().uuid("Pick a valid user."),
  badge_id: z.string().trim().min(1, "Pick a badge.").max(20, "Invalid badge id."),
});
export type AwardBadgeInput = z.infer<typeof awardBadgeSchema>;
