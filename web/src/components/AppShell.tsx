"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { GedaStrip, LanguageSwitcher, Logo } from "@/components/Shell";
import { Spinner } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { useAuth } from "@/lib/auth";

const TABS: { href: string; label: MessageKey; icon: React.ReactNode }[] = [
  { href: "/home", label: "nav.home2", icon: <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" /> },
  { href: "/together", label: "nav.together", icon: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15 14c3 0 6 1.6 6 5" /></> },
  { href: "/you", label: "nav.you", icon: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.8 3.1-6 7-6s7 2.2 7 6" /></> },
];

/** Signed-in citizens: three tabs and nothing else. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role !== "citizen") router.replace("/geda");
    else if (!user.onboarded) router.replace("/join");
  }, [loading, user, router]);

  if (loading || !user || user.role !== "citizen" || !user.onboarded) {
    return <div className="mx-auto w-full max-w-5xl px-4 pt-10"><Spinner /></div>;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <GedaStrip />
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Logo />
          <nav aria-label="Main" className="hidden gap-1 sm:flex">
            {TABS.map((tab) => (
              <Link key={tab.href} href={tab.href}
                className={`rounded-full px-5 py-2 text-sm font-medium transition ${pathname.startsWith(tab.href) ? "bg-navy text-white" : "text-muted hover:bg-surface-2 hover:text-text"}`}>
                {t(tab.label)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <LanguageSwitcher />
            <button onClick={() => { signOut(); router.replace("/"); }} className="whitespace-nowrap text-muted hover:text-text">{t("nav.signOut2")}</button>
          </div>
        </div>
      </header>

      <main key={locale} className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-8 sm:px-8 sm:pb-12">{children}</main>

      <nav aria-label="Tabs" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {TABS.map((tab) => {
          const on = pathname.startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${on ? "text-brand" : "text-muted"}`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{tab.icon}</svg>
              {t(tab.label)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
