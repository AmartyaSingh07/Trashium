"use client";

import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Coordinate matrix mapping for your active West Bengal operational zones
const SECTOR_COORDINATES: Record<string, [number, number]> = {
  "Rishra": [22.7102, 88.3204],
  "Howrah": [22.5958, 88.2636],
  "Shyamnagar": [22.8271, 88.3768],
  "Tarakeswar": [22.8872, 88.0163],
  "Hugli-Chinsura": [22.9079, 88.3912]
};

// Fix for default Leaflet marker icon asset paths breaking in Next.js builds
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const vehicleIcon = L.divIcon({
  html: '<div class="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md animate-pulse" className="w-4 h-4 bg-blue-600 rounded-full border-2 border-white shadow-md animate-pulse"></div>',
  className: "custom-vehicle-marker",
  iconSize: [16, 16]
});

interface RouteMapProps {
  activeZones: string[];
}

// Subcomponent to dynamically snap map center focus based on incoming data
function ChangeMapCenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function CrewRouteMap({ activeZones }: RouteMapProps) {
  const [crewLocation, setCrewLocation] = useState<[number, number] | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;
    
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCrewLocation([position.coords.latitude, position.coords.longitude]);
        if (map) {
          map.flyTo([position.coords.latitude, position.coords.longitude], map.getZoom(), {
            animate: true,
            duration: 1.5 // Smoothly slide the map viewport to keep the crew truck centered on screen
          });
        }
      },
      (error) => {
        console.warn("GPS access denied, defaulting map view to centralized Hooghly region.");
        // Fallback directly to Rishra coordinates so the map doesn't freeze!
        setCrewLocation((prev) => {
          if (!prev) return [22.7102, 88.3204];
          return prev;
        });
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [map]);

  // Extract coordinates for current pickups, fallback to centralized Hooghly region view
  const targetPoints = activeZones
    .map(zone => SECTOR_COORDINATES[zone])
    .filter(Boolean);

  const activePathWaypoints = crewLocation 
    ? [crewLocation, ...targetPoints] 
    : targetPoints;

  const mapCenter: [number, number] = crewLocation 
    ? crewLocation 
    : (targetPoints.length > 0 ? targetPoints[0] : [22.75, 88.25]);

  return (
    <div className="w-full h-full min-h-[300px] rounded-xl overflow-hidden border border-[rgba(196,112,74,0.15)] z-10">
      <MapContainer 
        center={mapCenter} 
        zoom={10} 
        scrollWheelZoom={false} 
        className="w-full h-full h-[320px]"
        ref={setMap}
      >
        {/* Free tile service layer sourced from OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <ChangeMapCenter center={mapCenter} />

        {/* Active tracking node for driver/vehicle */}
        {crewLocation && (
          <Marker position={crewLocation} icon={vehicleIcon}>
            <Popup>
              <span className="font-dm text-xs font-bold text-[#2C1F14]">Your Active Position</span>
            </Popup>
          </Marker>
        )}

        {/* Dynamic Waypoint Pin Mapping */}
        {activeZones.map((zone, idx) => {
          const coords = SECTOR_COORDINATES[zone];
          if (!coords) return null;
          return (
            <Marker key={idx} position={coords} icon={defaultIcon}>
              <Popup>
                <div className="font-dm p-1 text-center">
                  <span className="font-syne font-bold text-[#C4704A] block text-sm">{zone} Sector</span>
                  <span className="font-mono text-[10px] text-[#6B5744] bg-[#F4EFE6] px-1.5 py-0.5 rounded mt-1 block">
                    Lat: {coords[0]} | Long: {coords[1]}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Optimized Route Vector Polyline connector thread string overlay */}
        {activePathWaypoints.length > 1 && (
          <Polyline positions={activePathWaypoints} color="#C4704A" weight={4} dashArray="5, 10" />
        )}
      </MapContainer>
    </div>
  );
}
