"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, type AppNotification } from "@/lib/api";

/** A bell with an unread count; opening it marks everything read. */
export function NotificationBell() {
  const [data, setData] = useState<{ unread: number; items: AppNotification[] } | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(() => api.notifications().then(setData, () => undefined), []);
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && data?.unread) {
      await api.markNotificationsRead().catch(() => undefined);
      // Keep the unread styling visible for this opening, clear the badge.
      setData((d) => (d ? { ...d, unread: 0 } : d));
    }
  }

  return (
    <div className="relative" ref={box}>
      <button onClick={toggle} aria-label={`Notifications${data?.unread ? `, ${data.unread} unread` : ""}`} aria-expanded={open}
        className="relative grid h-8 w-8 place-items-center rounded-full text-[#cfeee6] hover:bg-white/15 hover:text-white">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {!!data?.unread && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications"
          className="absolute right-0 top-10 z-30 w-80 max-w-[85vw] rounded-2xl border border-border bg-white p-2 shadow-lg">
          {data?.items.length ? (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id}>
                  <Link href={n.url} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2 hover:bg-surface-2">
                    <p className={`text-sm ${n.read ? "" : "font-semibold"}`}>{n.title}</p>
                    <p className="text-xs text-muted">{n.body}</p>
                    <p className="mt-0.5 text-[11px] text-muted">{new Date(n.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-muted">Nothing yet. Photo decisions and society messages show up here.</p>
          )}
        </div>
      )}
    </div>
  );
}
