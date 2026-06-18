"use client";

import React from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface TrackingMapProps {
  interpolatedCoords: [number, number] | null;
  userHome: [number, number];
  userZone: string;
}

// Animated pulsing truck marker icon
const truckIcon = L.divIcon({
  html: `<div style="
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    background: rgba(74,103,65,0.15);
    border: 2px solid rgba(143,163,126,0.6);
    border-radius: 50%;
    box-shadow: 0 0 12px rgba(143,163,126,0.4), 0 4px 12px rgba(0,0,0,0.15);
    animation: marker-pulse 2s ease-in-out infinite;
  ">🚛</div>
  <style>
    @keyframes marker-pulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(143,163,126,0.4); }
      50% { transform: scale(1.08); box-shadow: 0 0 20px rgba(143,163,126,0.6); }
    }
  </style>`,
  className: "tracking-truck-marker",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Static home/destination pin
const homeIcon = L.divIcon({
  html: `<div style="
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    background: rgba(194,112,61,0.15);
    border: 2px solid rgba(194,112,61,0.5);
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  ">🏠</div>`,
  className: "tracking-home-marker",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function TrackingMap({ interpolatedCoords, userHome, userZone }: TrackingMapProps) {
  const mapCenter: [number, number] = interpolatedCoords || userHome;

  return (
    <div className="w-full h-full">
      <MapContainer
        center={mapCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full"
        zoomControl={false}
      >
        {/* Premium map tile layer — CartoDB Voyager for clean earthy aesthetics */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* User Home / Destination Marker */}
        <Marker position={userHome} icon={homeIcon}>
          <Popup>
            <div className="text-center p-1">
              <span className="font-syne font-bold text-sm text-[#C2703D] block">
                Your Location
              </span>
              <span className="font-mono text-[10px] text-[#6B5744] block mt-0.5">
                {userZone} Sector
              </span>
              <span className="font-mono text-[10px] text-[#6B5744] bg-[#F4EFE3] px-1.5 py-0.5 rounded mt-1 block">
                {userHome[0].toFixed(4)}°N, {userHome[1].toFixed(4)}°E
              </span>
            </div>
          </Popup>
        </Marker>

        {/* Animated destination ring pulse */}
        <CircleMarker
          center={userHome}
          radius={30}
          pathOptions={{
            color: "rgba(194,112,61,0.25)",
            fillColor: "rgba(194,112,61,0.08)",
            fillOpacity: 0.5,
            weight: 1.5,
          }}
        />

        {/* Live Crew Truck Marker */}
        {interpolatedCoords && (
          <>
            <Marker position={interpolatedCoords} icon={truckIcon}>
              <Popup>
                <div className="text-center p-1">
                  <span className="font-syne font-bold text-sm text-[#4A6741] block">
                    Collection Truck
                  </span>
                  <span className="font-mono text-[10px] text-[#6B5744] block mt-0.5">
                    Live GPS Position
                  </span>
                  <span className="font-mono text-[10px] text-[#6B5744] bg-[#F4EFE3] px-1.5 py-0.5 rounded mt-1 block">
                    {interpolatedCoords[0].toFixed(5)}°N, {interpolatedCoords[1].toFixed(5)}°E
                  </span>
                </div>
              </Popup>
            </Marker>

            {/* Crew position glow ring */}
            <CircleMarker
              center={interpolatedCoords}
              radius={18}
              pathOptions={{
                color: "rgba(143,163,126,0.3)",
                fillColor: "rgba(143,163,126,0.1)",
                fillOpacity: 0.6,
                weight: 1.5,
              }}
            />

            {/* Route vector line: crew → home */}
            <Polyline
              positions={[interpolatedCoords, userHome]}
              pathOptions={{
                color: "#C2703D",
                weight: 3,
                opacity: 0.6,
                dashArray: "8, 12",
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
