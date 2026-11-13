"use client";

import { FunnelPanel, ThemesPanel } from "@/components/GedaPanels";

export default function EngagementPage() {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <FunnelPanel />
      <ThemesPanel />
    </div>
  );
}
