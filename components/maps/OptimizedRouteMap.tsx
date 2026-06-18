"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchOsrmRoute } from "@/lib/osrm";
import type { RouteStop } from "@/lib/route-optimizer";

// Numbered stop marker (visiting order), in the brand copper.
const stopIcon = (n: number) =>
  L.divIcon({
    html: `<div style="background:#C2703D;color:#F4EFE3;font:700 11px/24px var(--font-syne,sans-serif);width:24px;height:24px;border-radius:9999px;border:2px solid #F4EFE3;box-shadow:0 1px 4px rgba(0,0,0,.35);text-align:center">${n}</div>`,
    className: "optimized-stop-marker",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const depotIcon = L.divIcon({
  html: `<div style="background:#2A2218;color:#F4EFE3;font:700 10px/22px var(--font-syne,sans-serif);width:22px;height:22px;border-radius:6px;border:2px solid #F4EFE3;box-shadow:0 1px 4px rgba(0,0,0,.35);text-align:center">⌂</div>`,
  className: "optimized-depot-marker",
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

interface Props {
  stops: RouteStop[];
  depot?: { lat: number; lng: number };
}

export default function OptimizedRouteMap({ stops, depot }: Props) {
  // Ordered [lat,lng] waypoints: depot first (if any), then each stop.
  const waypoints: [number, number][] = [
    ...(depot ? [[depot.lat, depot.lng] as [number, number]] : []),
    ...stops.map((s) => [s.latitude, s.longitude] as [number, number]),
  ];

  // OSRM road polyline; null until loaded / on failure → straight-line fallback.
  const [roadLine, setRoadLine] = useState<[number, number][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRoadLine(null);
    if (waypoints.length < 2) return;
    fetchOsrmRoute(waypoints.map(([lat, lng]) => ({ lat, lng }))).then((line) => {
      if (!cancelled) setRoadLine(line);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(waypoints)]);

  const center: [number, number] = waypoints[0] ?? [22.75, 88.25];

  return (
    <div className="w-full h-full min-h-[300px] rounded-xl overflow-hidden border border-[rgba(194,112,61,0.15)] z-10">
      <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="w-full h-[320px]">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {depot && (
          <Marker position={[depot.lat, depot.lng]} icon={depotIcon}>
            <Popup>
              <span className="font-dm text-xs font-bold text-[#2A2218]">Hub / Depot</span>
            </Popup>
          </Marker>
        )}

        {stops.map((s, i) => (
          <Marker key={s.id} position={[s.latitude, s.longitude]} icon={stopIcon(i + 1)}>
            <Popup>
              <div className="font-dm p-1">
                <span className="font-syne font-bold text-[#C2703D] block text-sm">
                  Stop {i + 1}
                </span>
                {s.address && <span className="text-[11px] text-[#6B5744] block">{s.address}</span>}
                <span className="font-mono text-[10px] text-[#6B5744] block mt-0.5">
                  {s.material_type ? `${s.material_type} · ` : ""}
                  {s.weight} kg{s.time_slot ? ` · ${s.time_slot}` : ""}
                </span>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Road polyline from OSRM; dashed straight-line fallback if it fails. */}
        {waypoints.length > 1 &&
          (roadLine ? (
            <Polyline positions={roadLine} color="#C2703D" weight={4} />
          ) : (
            <Polyline positions={waypoints} color="#C2703D" weight={3} dashArray="5, 10" />
          ))}
      </MapContainer>
    </div>
  );
}
