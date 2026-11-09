"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Badge, Card, CardTitle, fmt } from "@/components/ui";
import { api, type Activity } from "@/lib/api";

const POLL_MS = 5000;

function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/** Live booth screen: a QR code to join, and a feed of real sign-ups and actions as they happen. */
export function BoothPanel({ onActivity }: { onActivity: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [feed, setFeed] = useState<Activity[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const latest = useRef<string | null>(null);
  const onActivityRef = useRef(onActivity);

  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  useEffect(() => {
    const url = `${window.location.origin}/register`;
    QRCode.toDataURL(url, { margin: 1, width: 320 }).then((data) => {
      setJoinUrl(url);
      setQr(data);
    });
  }, []);

  useEffect(() => {
    let live = true;
    async function poll() {
      try {
        const events = await api.activity(latest.current);
        if (!live) return;
        setNow(Date.now());
        if (!events.length) return;
        latest.current = events[0].at;
        const keys = new Set(events.map((e) => `${e.kind}${e.at}`));
        setFeed((old) => [...events, ...old].slice(0, 12));
        setFresh(keys);
        onActivityRef.current();
      } catch {
        // Keep the booth screen up through brief network drops; the next poll catches up.
      }
    }
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <Card className="border-brand/40">
      <CardTitle aside={<Badge tone="sun">Live</Badge>}>Join Mission LiFE now</CardTitle>
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="text-center">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated data URL
            <img src={qr} alt={`QR code to sign up at ${joinUrl}`} className="mx-auto h-56 w-56 rounded-xl bg-white p-2" />
          ) : (
            <div className="h-56 w-56" />
          )}
          <p className="mt-2 text-xs text-muted">Scan, sign up, snap your electricity bill.</p>
          <p className="text-xs font-medium break-all">{joinUrl.replace(/^https?:\/\//, "")}</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Happening now across Gujarat</p>
          {feed.length === 0 ? (
            <p className="text-sm text-muted">Waiting for the first sign-up…</p>
          ) : (
            <ul className="space-y-2" aria-live="polite">
              {feed.map((e) => (
                <li
                  key={`${e.kind}${e.at}`}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-1000 ${
                    fresh.has(`${e.kind}${e.at}`) ? "bg-brand-soft" : "bg-surface-2"
                  }`}
                >
                  <span>
                    <strong>{e.first_name}</strong>
                    {e.district && <span className="text-muted"> · {e.district}</span>}{" "}
                    {e.kind === "joined"
                      ? "joined Mission LiFE"
                      : e.kind === "proof"
                        ? `sent photo proof: ${e.action_title}`
                        : `${e.action_title}${e.co2_saved_kg ? ` (−${fmt.kg(e.co2_saved_kg)} CO₂)` : ""}`}
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">{ago(e.at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
