// Lightweight, dependency-free route optimization for crew pickups.
// Capacity-aware nearest-neighbor construction + 2-opt improvement.
// Runs entirely client-side — no Python, no solver service.

export interface RouteStop {
  id: string;
  latitude: number;
  longitude: number;
  weight: number; // estimated kg
  time_slot?: string;
  address?: string;
  material_type?: string;
}

export interface TruckConstraints {
  maxLoadKg: number;
  maxStops: number;
}

export interface OptimizedRoute {
  /** Stops in visiting order (already capacity-trimmed). */
  sequence: RouteStop[];
  /** Stops that didn't fit this run (over capacity / stop limit). */
  deferred: RouteStop[];
  /** Total straight-line route distance in km (Haversine). */
  totalKm: number;
  totalWeight: number;
}

const R = 6371; // km

/** Haversine great-circle distance between two lat/lng points (km). */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function routeDistance(stops: RouteStop[], depot?: { lat: number; lng: number }): number {
  if (stops.length === 0) return 0;
  let total = 0;
  let prevLat = depot ? depot.lat : stops[0].latitude;
  let prevLng = depot ? depot.lng : stops[0].longitude;
  const start = depot ? 0 : 1;
  for (let i = start; i < stops.length; i++) {
    total += haversineKm(prevLat, prevLng, stops[i].latitude, stops[i].longitude);
    prevLat = stops[i].latitude;
    prevLng = stops[i].longitude;
  }
  return total;
}

/**
 * Build an optimized pickup route.
 *
 * 1. Filters out stops without coordinates.
 * 2. Greedy nearest-neighbor from the depot (or first stop) respecting capacity
 *    (maxLoadKg) and maxStops. Stops that don't fit are deferred.
 * 3. 2-opt local search to shorten the constructed tour.
 *
 * Time slots: stops are ordered primarily by the optimizer; if you want a hard
 * time-window pass, sort the input by time_slot first and the NN will respect a
 * rough ordering. Kept simple deliberately for the demo.
 */
export function optimizeRoute(
  stops: RouteStop[],
  constraints: TruckConstraints,
  depot?: { lat: number; lng: number },
): OptimizedRoute {
  const valid = stops.filter(
    (s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude),
  );

  // --- Capacity-aware nearest-neighbor construction ---
  const remaining = [...valid];
  const sequence: RouteStop[] = [];
  let load = 0;
  let curLat = depot ? depot.lat : remaining[0]?.latitude ?? 0;
  let curLng = depot ? depot.lng : remaining[0]?.longitude ?? 0;

  while (
    remaining.length > 0 &&
    sequence.length < constraints.maxStops
  ) {
    // nearest feasible (fits remaining capacity) stop
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      if (load + remaining[i].weight > constraints.maxLoadKg) continue;
      const d = haversineKm(
        curLat,
        curLng,
        remaining[i].latitude,
        remaining[i].longitude,
      );
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break; // nothing else fits
    const next = remaining.splice(bestIdx, 1)[0];
    sequence.push(next);
    load += next.weight;
    curLat = next.latitude;
    curLng = next.longitude;
  }

  // --- 2-opt improvement ---
  let improved = true;
  while (improved && sequence.length > 3) {
    improved = false;
    for (let i = 0; i < sequence.length - 1; i++) {
      for (let k = i + 1; k < sequence.length; k++) {
        const before = routeDistance(sequence, depot);
        const reversed = sequence
          .slice(0, i)
          .concat(sequence.slice(i, k + 1).reverse(), sequence.slice(k + 1));
        const after = routeDistance(reversed, depot);
        if (after + 1e-9 < before) {
          sequence.splice(0, sequence.length, ...reversed);
          improved = true;
        }
      }
    }
  }

  return {
    sequence,
    deferred: remaining,
    totalKm: routeDistance(sequence, depot),
    totalWeight: load,
  };
}
