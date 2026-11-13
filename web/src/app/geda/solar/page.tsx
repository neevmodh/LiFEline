"use client";

import { SolarPlanner } from "@/components/Console";
import { useConsole } from "@/components/geda/ConsoleContext";
import { Spinner } from "@/components/ui";

export default function SolarPage() {
  const { overview: o } = useConsole();
  if (!o) return <Spinner />;
  return <SolarPlanner districts={o.districts.map((d) => ({ id: d.district_id, name: d.district })).sort((a, b) => a.name.localeCompare(b.name))} />;
}
