"use client";

import Link from "next/link";
import { Logo } from "@/components/AppShell";
import { Card } from "@/components/ui";
import { LanguageSwitcher, useI18n, type MessageKey } from "@/i18n";

export type Audience = "citizen" | "society" | "geda";

const ROLES: { audience: Audience; icon: string; tint: string; title: MessageKey; body: MessageKey }[] = [
  { audience: "citizen", icon: "🏠", tint: "bg-brand-soft", title: "hub.citizen", body: "hub.citizenBody" },
  { audience: "society", icon: "🏢", tint: "bg-sky-soft", title: "hub.society", body: "hub.societyBody" },
  { audience: "geda", icon: "🏛️", tint: "bg-sun-soft", title: "hub.geda", body: "hub.gedaBody" },
];

/** First step of signing in: who are you signing in as? */
export function LoginHub({ onPick }: { onPick: (a: Audience) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-4">
        <Logo />
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-xl shadow-[var(--shadow-lg)] sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{t("hub.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("hub.sub")}</p>
        <div className="mt-6 space-y-3">
          {ROLES.map((r) => (
            <button
              key={r.audience}
              onClick={() => onPick(r.audience)}
              className="flex w-full items-center gap-4 rounded-2xl border border-border bg-white p-4 text-left shadow-[var(--shadow)] transition hover:border-brand hover:bg-surface-2"
            >
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${r.tint}`} aria-hidden>
                {r.icon}
              </span>
              <span>
                <span className="block font-semibold">{t(r.title)}</span>
                <span className="block text-sm text-muted">{t(r.body)}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          {t("auth.newHere")}{" "}
          <Link href="/register" className="font-medium text-brand">
            {t("auth.createLink")}
          </Link>
        </p>
      </Card>
    </div>
  );
}
