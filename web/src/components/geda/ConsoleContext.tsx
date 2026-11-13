"use client";

// What every console page shares: the headline figures (refreshed every minute while the tab is
// open), when they were last updated, and the signed-in staff member's role.
import { createContext, useContext, useEffect, useState } from "react";
import { useLoad } from "@/components/ui";
import { api, type AdminOverview } from "@/lib/api";

interface ConsoleState {
  overview: AdminOverview | null;
  error: string | null;
  updated: Date;
  auto: boolean;
  setAuto: (on: boolean) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<ConsoleState | null>(null);

export function ConsoleProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const overview = useLoad(api.adminOverview);
  const [updated, setUpdated] = useState<Date>(() => new Date());
  const [auto, setAuto] = useState(true);
  const refresh = async () => { await overview.reload(); setUpdated(new Date()); };

  useEffect(() => {
    if (!auto || !enabled) return;
    const h = setInterval(() => { void overview.reload().then(() => setUpdated(new Date())); }, 60_000);
    return () => clearInterval(h);
  }, [auto, enabled, overview]);

  return (
    <Ctx.Provider value={{ overview: overview.data, error: overview.error, updated, auto, setAuto, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useConsole(): ConsoleState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useConsole outside ConsoleProvider");
  return c;
}
