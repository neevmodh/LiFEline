"use client";

import dynamic from "next/dynamic";

export interface MapMetric {
  label: string;
  /** Value per district name; missing or null renders as "no data". */
  values: Record<string, number | null | undefined>;
  format: (v: number) => string;
}

export interface GujaratMapProps {
  metric: MapMetric;
  /** District drawn with a solid outline (e.g. the one open in a detail panel). */
  selected?: string | null;
  /** District drawn with a dashed outline (e.g. the viewer's own). */
  highlight?: string | null;
  onSelect?: (district: string) => void;
  /** Extra tooltip lines for a district. */
  tooltipExtra?: (district: string) => string[];
  height?: number;
}

/** Choropleth of Gujarat's 33 districts. Leaflet needs `window`, so it only renders in the browser. */
export const GujaratMap = dynamic(() => import("./GujaratMapInner"), {
  ssr: false,
  loading: () => <div className="h-[440px] animate-pulse rounded-xl bg-surface-2" />,
});
