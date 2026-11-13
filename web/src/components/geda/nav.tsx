// The console's pages, in sidebar order, with a line icon each (drawn here, no icon library).
import type { MessageKey } from "@/i18n";

export type PageId = "overview" | "map" | "districts" | "engagement" | "projection" | "solar" | "leads" | "community" | "campaigns" | "reviews";

export const PAGES: { id: PageId; href: string; label: MessageKey; desc: MessageKey }[] = [
  { id: "overview", href: "/geda", label: "con.nav.overview", desc: "con.desc.overview" },
  { id: "map", href: "/geda/map", label: "con.nav.map", desc: "con.desc.map" },
  { id: "districts", href: "/geda/districts", label: "con.nav.districts", desc: "con.desc.districts" },
  { id: "engagement", href: "/geda/engagement", label: "con.nav.engagement", desc: "con.desc.engagement" },
  { id: "projection", href: "/geda/projection", label: "con.nav.projection", desc: "con.desc.projection" },
  { id: "solar", href: "/geda/solar", label: "con.nav.solar", desc: "con.desc.solar" },
  { id: "leads", href: "/geda/leads", label: "con.nav.leads", desc: "con.desc.leads" },
  { id: "community", href: "/geda/communities", label: "con.nav.community", desc: "con.desc.community" },
  { id: "campaigns", href: "/geda/campaigns", label: "con.nav.campaigns", desc: "con.desc.campaigns" },
  { id: "reviews", href: "/geda/reviews", label: "con.nav.reviews", desc: "con.desc.reviews" },
];

const PATHS: Record<PageId, React.ReactNode> = {
  overview: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  map: <><path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  districts: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  engagement: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  projection: <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
  solar: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  leads: <><path d="M3 13h5l2 3h4l2-3h5" /><path d="M5.5 5h13L21 13v6H3v-6z" /></>,
  community: <><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-3-2-5-5-5.7" /></>,
  campaigns: <path d="M5 21V4h11l-1.5 4L16 12H5" />,
  reviews: <><circle cx="12" cy="12" r="9" /><path d="M8 12l3 3 5-6" /></>,
};

export function PageIcon({ id, className = "h-5 w-5" }: { id: PageId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {PATHS[id]}
    </svg>
  );
}
