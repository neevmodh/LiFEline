"use client";

import { SolarLeadsPanel } from "@/components/GedaPanels";
import { useAuth } from "@/lib/auth";

export default function LeadsPage() {
  const { user } = useAuth();
  return <SolarLeadsPanel canEdit={user?.role === "admin" || user?.role === "officer"} />;
}
