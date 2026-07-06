export const OPERATIONAL_SECTORS = ['Rishra', 'Howrah', 'Shyamnagar', 'Tarakeswar', 'Hugli-Chinsura'] as const;

export type OperationalSector = (typeof OPERATIONAL_SECTORS)[number];

/**
 * `material_type` values shown as landing-page rate tiles
 * (components/materials/flipping-rates.tsx). Lives here (a pure, server-safe
 * module) so both the server page and the client tile component can import it -
 * importing it from the "use client" component turns it into a client-reference
 * stub on the server, which breaks Supabase `.in()`.
 */
export const TILE_MATERIAL_TYPES = [
  'AC Compressor',
  'Aluminum',
  'Battery',
  'Brass',
  'Cardboard',
  'Copper',
  'E-Waste',
  'Inverter Battery',
  'Iron',
  'Newspaper',
  'Plastic',
  'Stainless Steel',
  'Tin',
  'UPS Battery',
] as const;

// Sectors that share a single crew fleet - a crew assigned to either one covers both.
// ponytail: one shared hub for now; make this a list of groups if more hubs appear.
const SHARED_HUB: OperationalSector[] = ['Rishra', 'Hugli-Chinsura'];

/**
 * Sectors a crew with the given operating zone is responsible for.
 * - Rishra / Hugli-Chinsura -> both (shared fleet)
 * - any other sector -> just that one
 * - no zone (admin / unassigned) -> all sectors
 */
export function resolveHubSectors(zone: string | null | undefined): readonly string[] {
  if (!zone) return OPERATIONAL_SECTORS;
  if (SHARED_HUB.includes(zone as OperationalSector)) return SHARED_HUB;
  return [zone];
}

// -- Pickup proof (geo-tagged collection photo) -----------------------------

/**
 * Max distance (metres) between a crew's captured photo location and the
 * household's booked coordinates for the proof to count as "verified at
 * location". Beyond this, the proof is stored but flagged for admin review.
 */
export const PROOF_MATCH_RADIUS_M = 150;

/** Private Storage bucket holding geo-tagged crew collection photos. */
export const PICKUP_PROOFS_BUCKET = "pickup-proofs";

// -- Pickup batching (logistics profitability) ------------------------------

/**
 * Minimum number of pending pickups in the same sector on the same day for a
 * crew route to be profitable. The ML pricing model amortises the per-route
 * logistics base cost (see ml/config.py LOGISTICS_BASE) across the batch, so a
 * route with fewer than this many stops loses money.
 *
 * This is the client-side mirror of the threshold enforced by the
 * `get_batch_readiness()` RPC (which is authoritative for the live count).
 * Keep the two in sync if this ever changes.
 */
export const MIN_BATCH_SIZE = 3;

// -- Phase 2: route optimization --------------------------------------------

/** Default truck constraints used by the route optimizer (demo config). */
export const DEFAULT_TRUCK = {
  maxLoadKg: 500,
  maxStops: 15,
} as const;

/** Canonical hub/depot center per sector - used as the route start point. */
export const SECTOR_DEPOTS: Record<string, { lat: number; lng: number }> = {
  Rishra: { lat: 22.7102, lng: 88.3204 },
  Howrah: { lat: 22.5958, lng: 88.2636 },
  Shyamnagar: { lat: 22.8271, lng: 88.3768 },
  Tarakeswar: { lat: 22.8872, lng: 88.0163 },
  "Hugli-Chinsura": { lat: 22.9079, lng: 88.3912 },
};
