"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui";
import { LanguageSwitcher, useI18n, type MessageKey } from "@/i18n";
import { useAuth } from "@/lib/auth";

const CITIZEN_NAV: { href: string; label: MessageKey }[] = [
  { href: "/dashboard", label: "nav.home" },
  { href: "/actions", label: "nav.actions" },
  { href: "/community", label: "nav.community" },
  { href: "/solar", label: "nav.solar" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      <span
        className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-[#0a8157] to-[#34b27a] text-white shadow-[var(--shadow-lg)]"
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 21c0-9 5-15 15-16-1 10-7 15-16 15" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 21 13 13" strokeLinecap="round" />
        </svg>
      </span>
      LiFEline
    </Link>
  );
}

/** Wraps signed-in pages: redirects to login or onboarding and renders the nav. */
export function AppShell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading, signOut } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const signingOut = useRef(false);

  const needsOnboarding = user?.role === "citizen" && !user.onboarded && pathname !== "/onboarding";
  const staff = user?.role === "admin" || user?.role === "officer";
  const wrongRole = user && (admin ? !staff : staff);

  useEffect(() => {
    if (loading || signingOut.current) return;
    if (!user) router.replace("/login");
    else if (wrongRole) router.replace(staff ? "/admin" : "/dashboard");
    else if (needsOnboarding) router.replace("/onboarding");
  }, [loading, user, wrongRole, needsOnboarding, router, staff]);

  if (loading || !user || wrongRole || needsOnboarding) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4">
        <Spinner />
      </div>
    );
  }

  const nav: { href: string; label: MessageKey }[] = admin ? [{ href: "/admin", label: "nav.overview" }] : CITIZEN_NAV;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Logo />
          <nav className="hidden gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-1.5 text-sm transition ${
                  pathname.startsWith(item.href)
                    ? "bg-brand-soft font-semibold text-brand-strong"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <LanguageSwitcher />
            {admin ? (
              <span className="hidden text-muted md:inline">{user.name}</span>
            ) : (
              <Link
                href="/profile"
                className={`max-w-32 truncate ${pathname === "/profile" ? "font-medium text-brand" : "text-muted hover:text-text"}`}
                title={t("nav.profile")}
              >
                {user.name}
              </Link>
            )}
            <button
              onClick={() => {
                signingOut.current = true;
                signOut();
                router.replace("/");
              }}
              className="text-muted hover:text-text"
            >
              {t("nav.signOut")}
            </button>
          </div>
        </div>
      </header>

      {/* Keyed by language so pages reload text the API translates (actions, nudges). */}
      <main key={locale} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:pb-10">
        {children}
        <p className="mt-10 text-center text-xs text-muted">
          <Link href="/methodology" className="underline hover:text-text">
            {t("nav.methodology")}
          </Link>{" "}
          · {t("shell.methodologyNote")}
        </p>
      </main>

      {/* Bottom tab bar on phones */}
      {!admin && (
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border/60 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`py-3 text-center text-xs ${
                pathname.startsWith(item.href) ? "font-semibold text-brand" : "text-muted"
              }`}
            >
              {t(item.label)}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
