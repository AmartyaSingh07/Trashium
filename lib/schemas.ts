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
