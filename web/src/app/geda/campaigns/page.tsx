"use client";

import { CampaignsPanel } from "@/components/GedaPanels";
import { useAuth } from "@/lib/auth";

export default function CampaignsPage() {
  const { user } = useAuth();
  return <CampaignsPanel canRunState={user?.role === "admin"} />;
}
