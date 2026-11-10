"use client";

import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { flushQueue, pendingCount } from "@/lib/offline";

/** Registers the service worker, syncs actions queued offline, and shows the connection state. */
export function PwaSupport() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [synced, setSynced] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    // Free hosting sleeps when idle; a cheap health ping on page load wakes it before it's needed.
    fetch(`${API_URL}/api/health`).catch(() => undefined);
    const sync = async () => {
      setOnline(navigator.onLine);
      setPending(pendingCount());
      if (!navigator.onLine) return;
      const sent = await flushQueue((code, note) => api.logAction(code, note));
      if (sent) setSynced(sent);
      setPending(pendingCount());
    };
    const update = () => setPending(pendingCount());
    const clearSynced = setInterval(() => setSynced(0), 6000);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    window.addEventListener("nidhi:queue", update);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("nidhi:queue", update);
      clearInterval(clearSynced);
    };
  }, []);

  if (online && !pending && !synced) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-40 bg-sun-soft px-4 py-1.5 text-center text-xs font-medium">
      {!online
        ? `You're offline. Actions you log are saved on this phone${pending ? ` (${pending} waiting)` : ""} and sent when you're back online.`
        : pending
          ? `Sending ${pending} saved action${pending === 1 ? "" : "s"}…`
          : `Synced ${synced} action${synced === 1 ? "" : "s"} logged offline.`}
    </div>
  );
}
