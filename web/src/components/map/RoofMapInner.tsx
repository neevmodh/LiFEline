"use client";

// The roof measurer's map: satellite imagery (Esri, no key), tap the roof's corners and the shape and
// its area follow. Leaflet needs `window`, so this file is only loaded in the browser.
import "leaflet/dist/leaflet.css";
import type { LatLngExpression, LeafletMouseEvent } from "leaflet";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";

import type { LatLng } from "@/lib/roof";

const IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";

function Taps({ onTap }: { onTap: (p: LatLng) => void }) {
  useMapEvents({ click: (e: LeafletMouseEvent) => onTap([e.latlng.lat, e.latlng.lng]) });
  return null;
}

function FlyTo({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center as LatLngExpression, 19, { duration: 0.8 });
  }, [center, map]);
  return null;
}

export default function RoofMapInner({ center, points, onTap }: { center: LatLng; points: LatLng[]; onTap: (p: LatLng) => void }) {
  return (
    <MapContainer center={center as LatLngExpression} zoom={18} maxZoom={20} className="h-full w-full" scrollWheelZoom>
      <TileLayer url={IMAGERY} maxZoom={20} maxNativeZoom={19} attribution="Imagery © Esri, Maxar, Earthstar Geographics" />
      <TileLayer url={LABELS} maxZoom={20} maxNativeZoom={19} />
      <Taps onTap={onTap} />
      <FlyTo center={center} />
      {points.length >= 3 ? (
        <Polygon positions={points as LatLngExpression[]} pathOptions={{ color: "#E9B872", weight: 3, fillColor: "#E9B872", fillOpacity: 0.35 }} />
      ) : points.length === 2 ? (
        <Polyline positions={points as LatLngExpression[]} pathOptions={{ color: "#E9B872", weight: 3 }} />
      ) : null}
      {points.map((p, i) => (
        <CircleMarker key={i} center={p as LatLngExpression} radius={6} pathOptions={{ color: "#23312A", weight: 2, fillColor: "#FFFDF8", fillOpacity: 1 }} />
      ))}
    </MapContainer>
  );
}
