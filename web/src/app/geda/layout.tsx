"use client";

// The GEDA console's frame: a sidebar of pages (a scrolling tab bar on phones), the agency strip,
// language, refresh, print and sign out, and each page's title. Only GEDA staff get past it;
// a photo reviewer sees the review queue alone.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ConsoleProvider, useConsole } from "@/components/geda/ConsoleContext";
import { PAGES, PageIcon, type PageId } from "@/components/geda/nav";
import { GedaStrip, LanguageSwitcher, Logo } from "@/components/Shell";
import { Spinner, useLoad } from "@/components/ui";
import { dateTag, useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function currentPage(pathname: string) {
  return PAGES.find((p) => (p.href === "/geda" ? pathname === "/geda" : pathname.startsWith(p.href))) ?? PAGES[0];
}

function useBadges(): Partial<Record<PageId, number>> {
  const { overview } = useConsole();
  const leads = useLoad(api.adminSolarLeads);
  const campaigns = useLoad(api.adminCampaigns);
  return {
    reviews: overview?.pending_reviews ?? 0,
    leads: leads.data?.counts.new ?? 0,
    campaigns: campaigns.data?.filter((c) => c.status === "active").length ?? 0,
  };
}

function Frame({ reviewer, children }: { reviewer: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const { updated, auto, setAuto, refresh } = useConsole();
  const badges = useBadges();
  const page = currentPage(pathname);
  const pages = reviewer ? PAGES.filter((p) => p.id === "reviews") : PAGES;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-bg">
      <GedaStrip />
      <header className="no-print border-b border-border bg-surface">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo size={40} />
            <div className="hidden leading-tight sm:block">
              <p className="text-sm font-bold">{t("geda.title")}</p>
              <p className="text-xs text-muted">{t("geda.kicker")}{reviewer && ` · ${t("geda.reviewerOnly")}`}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
            {!reviewer && (
              <>
                <span className="hidden text-muted md:inline">{t("con.updated", { time: updated.toLocaleTimeString(dateTag(), { hour: "2-digit", minute: "2-digit" }) })}</span>
                <label className="hidden items-center gap-2 rounded-full bg-surface-2 px-3 py-1.5 md:flex">
                  <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="accent-[#c9873e]" />
                  {t("con.auto")}
                </label>
                <button onClick={() => void refresh()} className="rounded-full bg-surface-2 px-3 py-1.5 font-semibold hover:bg-border">{t("con.refresh")}</button>
                <button onClick={() => window.print()} className="rounded-full bg-navy px-3 py-1.5 font-semibold text-[#f6f2ea] hover:bg-abyss">{t("con.print")}</button>
              </>
            )}
            <LanguageSwitcher />
            <button onClick={() => { signOut(); router.replace("/"); }} className="px-2 text-muted hover:text-text">{t("nav.signOut2")}</button>
          </div>
        </div>
        {/* Phones and tablets: the pages as a scrolling tab bar */}
        <nav aria-label={t("con.menu")} className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden">
          {pages.map((p) => (
            <Link key={p.id} href={p.href} aria-current={p.id === page.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold ${p.id === page.id ? "bg-navy text-[#f6f2ea]" : "text-muted hover:bg-surface-2"}`}>
              <PageIcon id={p.id} className="h-4 w-4" />{t(p.label)}
              {!!badges[p.id] && <span className="rounded-full bg-sun px-1.5 text-xs text-text">{badges[p.id]}</span>}
            </Link>
          ))}
        </nav>
      </header>

      <div className="flex flex-1">
        {/* Laptops: a sidebar */}
        <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 border-r border-border bg-surface lg:block">
          <nav aria-label={t("con.menu")} className="flex flex-col gap-1 p-3">
            {pages.map((p) => (
              <Link key={p.id} href={p.href} aria-current={p.id === page.id ? "page" : undefined}
                className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold ${p.id === page.id ? "bg-navy text-[#f6f2ea]" : "text-muted hover:bg-surface-2 hover:text-text"}`}>
                <PageIcon id={p.id} />
                <span className="flex-1">{t(p.label)}</span>
                {!!badges[p.id] && <span className={`rounded-full px-2 py-0.5 text-xs ${p.id === page.id ? "bg-[#f6f2ea] text-text" : "bg-sun-soft text-text"}`}>{badges[p.id]}</span>}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-8">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div>
              <h1 className="font-display text-3xl font-bold sm:text-4xl">{t(page.label)}</h1>
              <p className="mt-1 max-w-3xl text-muted">{t(page.desc)}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function GedaLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const reviewer = user?.role === "reviewer";
  const staff = !!user && user.role !== "citizen";

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (user.role === "citizen") router.replace("/"); // households use the app
    else if (user.role === "reviewer" && pathname !== "/geda/reviews") router.replace("/geda/reviews");
  }, [loading, user, router, pathname]);

  if (loading || !staff) return <div className="mx-auto w-full max-w-5xl px-4 pt-10"><Spinner /></div>;
  return (
    <ConsoleProvider enabled={!reviewer}>
      <Frame reviewer={reviewer}>{children}</Frame>
    </ConsoleProvider>
  );
}
