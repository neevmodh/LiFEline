"use client";

// All 33 districts side by side; ?d=<district> opens one with its wards, themes and trend.
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { DistrictDetailPanel, DistrictTable } from "@/components/Console";
import { useConsole } from "@/components/geda/ConsoleContext";
import { Spinner } from "@/components/ui";

function Districts() {
  const { overview: o } = useConsole();
  const router = useRouter();
  const selected = useSearchParams().get("d");
  if (!o) return <Spinner />;
  const sel = selected ? o.districts.find((d) => d.district === selected) : undefined;
  const open = (name: string) => {
    router.replace(`/geda/districts?d=${encodeURIComponent(name)}`, { scroll: false });
    setTimeout(() => document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  return (
    <div className="space-y-6">
      <DistrictTable rows={o.districts} onOpen={open} selected={selected} />
      <div id="detail" className="scroll-mt-6">
        {sel && <DistrictDetailPanel id={sel.district_id} onClose={() => router.replace("/geda/districts", { scroll: false })} />}
      </div>
    </div>
  );
}

export default function DistrictsPage() {
  return <Suspense fallback={<Spinner />}><Districts /></Suspense>;
}
