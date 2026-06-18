// OSRM road-routing helper with a safe straight-line fallback.
// Uses the free public OSRM demo server. If it rate-limits or fails, the caller
// should fall back to straight polylines so the map never breaks during a demo.

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Fetch a road-following polyline through the given ordered points from the OSRM
 * public demo server. Returns an array of [lat, lng] pairs for a Leaflet
 * Polyline, or null on any failure (caller falls back to straight lines).
 */
export async function fetchOsrmRoute(
  points: LatLng[],
): Promise<[number, number][] | null> {
  if (points.length < 2) return null;
  try {
    // OSRM expects lng,lat order, semicolon-separated.
    const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const line = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(line)) return null;

    // GeoJSON is [lng, lat] -> Leaflet wants [lat, lng]
    return line.map((c: [number, number]) => [c[1], c[0]]);
  } catch {
    return null;
  }
}
