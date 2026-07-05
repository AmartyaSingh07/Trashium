/**
 * Pure geo helpers — client + server safe (no browser/Node-only APIs).
 * Used by the crew pickup-proof flow to verify that a captured photo's
 * location is close enough to the household's booked coordinates.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000; // mean Earth radius in metres

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points in metres (haversine).
 * Returns a non-negative number; accurate to well within our ~150 m tolerance
 * over the short distances involved in a doorstep pickup verification.
 */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
