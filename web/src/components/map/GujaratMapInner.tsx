"use client";

import "leaflet/dist/leaflet.css";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Pane, TileLayer, useMap } from "react-leaflet";
import type { GujaratMapProps } from "./index";

interface DistrictProps {
  name: string;
  lat: number;
  lon: number;
}
type DistrictCollection = FeatureCollection<Geometry, DistrictProps>;

// Sequential single-hue ramps, validated as ordinal ramps against each theme's surface
// (monotone lightness, visible step gaps, lightest step clears 2:1). Dark mode flips the
// anchor: low values sit near the dark surface, high values glow.
const RAMP = {
  light: ["#a8e3c4", "#6fcf9f", "#34b27a", "#0a8157", "#065a3d"],
  dark: ["#1f6b45", "#2c8a5b", "#43aa75", "#6cc795", "#a3e0bd"],
};
const EMPTY = { light: "#e7efea", dark: "#2a332c" };
const BORDER = { light: "#ffffff", dark: "#161e18" };
const OUTLINE = { light: "#17231b", dark: "#e6eee7" };
// Esri's neutral canvas basemaps (no API key), with place labels as a separate layer so
// they can sit above the coloured districts.
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const TILES = {
  light: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
  dark: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
};
const LABELS = {
  light: `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
  dark: `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
};
const ATTRIBUTION =
  '&copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, <a href="https://www.openstreetmap.org/copyright">OSM</a> · Boundaries <a href="https://www.geoboundaries.org">geoBoundaries</a> (ODbL)';

let geoPromise: Promise<DistrictCollection> | null = null;
function loadDistricts() {
  geoPromise ??= fetch("/geo/gujarat-districts.geojson").then((r) => {
    if (!r.ok) throw new Error("Could not load district boundaries");
    return r.json();
  });
  return geoPromise;
}

// The app is light-only, so the map always uses its light ramps and basemap.
function useTheme(): "light" | "dark" {
  return "light";
}

/** Quantile class breaks (upper bounds) over the districts that have data. */
function classBreaks(values: number[], classes: number): number[] {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  if (sorted.length <= classes) return sorted;
  return Array.from({ length: classes }, (_, i) => sorted[Math.ceil(((i + 1) * sorted.length) / classes) - 1]);
}

function FitToDistricts({ data }: { data: DistrictCollection }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.geoJSON(data).getBounds();
    map.fitBounds(bounds, { padding: [6, 6] });
    map.setMaxBounds(bounds.pad(0.4));
  }, [map, data]);
  return null;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export default function GujaratMapInner({ metric, selected, highlight, onSelect, tooltipExtra, height = 440 }: GujaratMapProps) {
  const theme = useTheme();
  const [data, setData] = useState<DistrictCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDistricts().then(setData, (e: Error) => setError(e.message));
  }, []);

  const { breaks, colorFor } = useMemo(() => {
    const present = Object.values(metric.values).filter((v): v is number => typeof v === "number");
    const b = classBreaks(present, RAMP.light.length);
    const ramp = RAMP[theme];
    // Spread fewer classes across the full ramp so they stay distinguishable.
    const step = b.length > 1 ? (ramp.length - 1) / (b.length - 1) : 0;
    const colorFor = (v: number | null | undefined) => {
      if (typeof v !== "number") return EMPTY[theme];
      const idx = b.findIndex((upper) => v <= upper);
      return ramp[Math.round((idx === -1 ? b.length - 1 : idx) * step)];
    };
    return { breaks: b, colorFor };
  }, [metric.values, theme]);

  const style = useCallback(
    (feature?: Feature<Geometry, DistrictProps>): L.PathOptions => {
      const name = feature?.properties.name ?? "";
      const isSelected = name === selected;
      const isHighlighted = name === highlight;
      return {
        fillColor: colorFor(metric.values[name]),
        fillOpacity: 0.88,
        color: isSelected || isHighlighted ? OUTLINE[theme] : BORDER[theme],
        weight: isSelected ? 3 : isHighlighted ? 2.5 : 1,
        dashArray: isHighlighted && !isSelected ? "4 3" : undefined,
      };
    },
    [colorFor, metric.values, selected, highlight, theme],
  );

  const tooltipHtml = useCallback(
    (name: string) => {
      const value = metric.values[name];
      return [
        `<strong>${escapeHtml(name)}</strong>`,
        `${escapeHtml(metric.label)}: ${typeof value === "number" ? escapeHtml(metric.format(value)) : "No data yet"}`,
        ...(tooltipExtra?.(name) ?? []).map(escapeHtml),
      ].join("<br/>");
    },
    [metric, tooltipExtra],
  );

  // The district layer is built once; its event handlers read the latest props through this ref.
  const latest = useRef({ style, tooltipHtml, onSelect, theme });
  useEffect(() => {
    latest.current = { style, tooltipHtml, onSelect, theme };
  });

  // Restyle and refresh tooltips in place. Rebuilding the layer instead would leave any
  // open tooltip orphaned on screen.
  const geoRef = useRef<L.GeoJSON | null>(null);
  useEffect(() => {
    const geo = geoRef.current;
    if (!geo) return;
    geo.setStyle(style as L.StyleFunction);
    geo.eachLayer((layer) => {
      const feature = (layer as L.Layer & { feature?: Feature<Geometry, DistrictProps> }).feature;
      if (!feature) return;
      layer.setTooltipContent(tooltipHtml(feature.properties.name));
      // Draw outlined districts on top so neighbouring borders don't cover their outline.
      if (feature.properties.name === highlight || feature.properties.name === selected) (layer as L.Path).bringToFront();
    });
  }, [style, tooltipHtml, data, selected, highlight]);

  const onEachFeature = useCallback((feature: Feature<Geometry, DistrictProps>, layer: L.Layer) => {
    const name = feature.properties.name;
    const path = layer as L.Path;
    layer.bindTooltip(latest.current.tooltipHtml(name), { sticky: true, className: "nidhi-map-tooltip" });
    layer.on({
      // No bringToFront here: re-inserting the path under the cursor swallows the
      // mouseout that closes its tooltip.
      mouseover: () => {
        const { style, theme } = latest.current;
        path.setStyle({ weight: Math.max(2, style(feature).weight ?? 1), color: OUTLINE[theme] });
      },
      mouseout: () => path.setStyle(latest.current.style(feature)),
      click: () => latest.current.onSelect?.(name),
    });
  }, []);

  if (error) return <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>;
  if (!data) return <div className="animate-pulse rounded-xl bg-surface-2" style={{ height }} />;

  // Legend: one swatch per class with its range, plus "no data".
  const legend = breaks.map((upper, i) => ({
    color: colorFor(upper),
    label: i === 0 ? `≤ ${metric.format(upper)}` : `${metric.format(breaks[i - 1])} – ${metric.format(upper)}`,
  }));

  return (
    <div className="relative overflow-hidden rounded-xl border border-border" style={{ height }}>
      <MapContainer
        className="h-full w-full"
        style={{ background: theme === "dark" ? "#0e1310" : "#eaf3ee" }}
        center={[22.6, 71.5]}
        zoom={7}
        minZoom={5}
        maxZoom={11}
        zoomSnap={0.25}
        zoomDelta={0.5}
        scrollWheelZoom={false}
        attributionControl
        ref={(map) => {
          map?.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
        }}
      >
        <TileLayer url={TILES[theme]} attribution={ATTRIBUTION} key={`base-${theme}`} />
        <GeoJSON ref={geoRef} data={data} style={style} onEachFeature={onEachFeature} />
        <Pane name="labels" style={{ zIndex: 650, pointerEvents: "none" }}>
          <TileLayer url={LABELS[theme]} key={`labels-${theme}`} />
        </Pane>
        <FitToDistricts data={data} />
      </MapContainer>

      <div className="pointer-events-none absolute right-2 top-2 z-[1000] max-w-[55%] rounded-lg border border-border bg-surface/95 px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium">{metric.label}</p>
        <ul className="space-y-0.5">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-2 text-muted">
              <span className="h-3 w-3 rounded-sm" style={{ background: l.color }} aria-hidden />
              {l.label}
            </li>
          ))}
          <li className="flex items-center gap-2 text-muted">
            <span className="h-3 w-3 rounded-sm border border-border" style={{ background: EMPTY[theme] }} aria-hidden />
            No data yet
          </li>
        </ul>
      </div>
    </div>
  );
}
