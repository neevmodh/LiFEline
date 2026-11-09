"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardTitle } from "@/components/ui";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n";

function keyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "needs-install" | "off" | "on" | "blocked" | "unavailable";

/** Opt in to Green Hours and peak alerts on this device. */
export function AlertsToggle() {
  const { t } = useI18n();
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const { public_key } = await api.pushKey().catch(() => ({ public_key: null }));
      if (!live) return;
      if (!public_key) return setState("unavailable");
      setKey(public_key);
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const installed = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return setState(ios && !installed ? "needs-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (live) setState(sub ? "on" : "off");
    })();
    return () => {
      live = false;
    };
  }, []);

  async function enable() {
    if (!key) return;
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
      await api.pushSubscribe(sub.toJSON());
      setState("on");
    } catch {
      setState("unsupported");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await api.pushUnsubscribe(sub.endpoint).catch(() => undefined);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unavailable") return null;
  return (
    <Card>
      <CardTitle>{t("alerts.title")}</CardTitle>
      <p className="-mt-2 mb-3 text-sm text-muted">{t("alerts.intro")}</p>
      {state === "on" && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-brand">{t("alerts.on")}</p>
          <Button variant="ghost" onClick={disable} disabled={busy}>
            {t("alerts.turnOff")}
          </Button>
        </div>
      )}
      {state === "off" && (
        <Button onClick={enable} disabled={busy}>
          {t("alerts.turnOn")}
        </Button>
      )}
      {state === "blocked" && <p className="text-sm text-muted">{t("alerts.blocked")}</p>}
      {state === "needs-install" && <p className="text-sm text-muted">{t("alerts.install")}</p>}
      {state === "unsupported" && <p className="text-sm text-muted">{t("alerts.unsupported")}</p>}
    </Card>
  );
}
