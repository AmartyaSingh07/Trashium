export const OPERATIONAL_SECTORS = ['Rishra', 'Howrah', 'Shyamnagar', 'Tarakeswar', 'Hugli-Chinsura'] as const;

export type OperationalSector = (typeof OPERATIONAL_SECTORS)[number];

// Sectors that share a single crew fleet — a crew assigned to either one covers both.
// ponytail: one shared hub for now; make this a list of groups if more hubs appear.
const SHARED_HUB: OperationalSector[] = ['Rishra', 'Hugli-Chinsura'];

/**
 * Sectors a crew with the given operating zone is responsible for.
 * - Rishra / Hugli-Chinsura → both (shared fleet)
 * - any other sector → just that one
 * - no zone (admin / unassigned) → all sectors
 */
export function resolveHubSectors(zone: string | null | undefined): readonly string[] {
  if (!zone) return OPERATIONAL_SECTORS;
  if (SHARED_HUB.includes(zone as OperationalSector)) return SHARED_HUB;
  return [zone];
}

// ── Phase 2: route optimization ───────────────────────────────────────────

/** Default truck constraints used by the route optimizer (demo config). */
export const DEFAULT_TRUCK = {
  maxLoadKg: 500,
  maxStops: 15,
} as const;

/** Canonical hub/depot center per sector — used as the route start point. */
export const SECTOR_DEPOTS: Record<string, { lat: number; lng: number }> = {
  Rishra: { lat: 22.7102, lng: 88.3204 },
  Howrah: { lat: 22.5958, lng: 88.2636 },
  Shyamnagar: { lat: 22.8271, lng: 88.3768 },
  Tarakeswar: { lat: 22.8872, lng: 88.0163 },
  "Hugli-Chinsura": { lat: 22.9079, lng: 88.3912 },
};
