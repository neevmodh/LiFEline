// A two-minute start: a bill photo fills in the units and the electricity company, the district
// suggests the company when there's no photo, and the footprint preview updates as you answer.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Bar, Rise, useCountUp } from "@/components/motion";
import { BillScanArt, Stepper } from "@/components/stepper";
import { Body, Button, Choice, ErrorText, Field, Hero } from "@/components/ui";
import { BrandLogo } from "@/components/brand";
import { useI18n, type MessageKey } from "@/i18n";
import { useBillScan } from "@/lib/bill-scan";
import { api, ApiError, type CommuteMode, type Discom, type TariffArea } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { getItem, setItem } from "@/lib/storage";
import { fonts, radius, space, type, useColors } from "@/theme";

const DISCOMS: Discom[] = ["dgvcl", "mgvcl", "pgvcl", "ugvcl", "torrent"];
const COMMUTES: CommuteMode[] = ["two_wheeler", "car", "bus", "metro", "cycle_walk"];
/** Answers from the free bill check (same shape the web app stores), so nothing is typed twice. */
const GUEST_KEY = "nidhi.guest";

const num = (s: string, fallback = 0) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && s.trim() !== "" ? n : fallback;
};

export default function Onboarding() {
  const { t } = useI18n();
  const c = useColors();
  const { user, refresh } = useSession();
  const districts = useQuery({ queryKey: ["districts"], queryFn: api.districts });

  const [kwh, setKwh] = useState("");
  const [discom, setDiscom] = useState<Discom | null>(null);
  const [area, setArea] = useState<TariffArea>("urban");
  const [members, setMembers] = useState("4");
  const [acs, setAcs] = useState(1);
  const [geyser, setGeyser] = useState(true);
  const [washing, setWashing] = useState(true);
  const [commute, setCommute] = useState<CommuteMode>("two_wheeler");
  const [km, setKm] = useState("8");
  const [lpg, setLpg] = useState("1");
  const [roof, setRoof] = useState("");
  const { scan, pick: pickBill } = useBillScan((monthly, bill) => {
    setKwh(String(monthly));
    const d = bill.distributor?.toLowerCase();
    if (d && (DISCOMS as string[]).includes(d)) setDiscom(d as Discom);
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Free-check answers carry over.
  useEffect(() => {
    getItem(GUEST_KEY).then((raw) => {
      try {
        const g = raw ? JSON.parse(raw) : null;
        if (!g) return;
        if (g.monthly_kwh) setKwh(String(g.monthly_kwh));
        if (DISCOMS.includes(g.discom)) setDiscom(g.discom);
        if (g.area === "urban" || g.area === "rural") setArea(g.area);
        if (typeof g.ac_count === "number") setAcs(Math.min(g.ac_count, 3));
        if (typeof g.has_geyser === "boolean") setGeyser(g.has_geyser);
        if (g.roof_area_sqm) setRoof(String(g.roof_area_sqm));
      } catch {
        // Nothing usable carried over.
      }
    });
  }, []);

  // The district suggests the company until a bill or the user says otherwise.
  const suggested = districts.data?.find((d) => d.id === user?.district_id)?.suggested_discom;
  const company: Discom = discom ?? suggested ?? "ugvcl";

  const answers = {
    monthly_kwh: num(kwh),
    members: Math.max(1, Math.round(num(members, 1))),
    lpg_cylinders_per_month: num(lpg),
    commute_mode: commute,
    commute_km_per_day: commute === "cycle_walk" ? 0 : num(km),
    discom: company,
    area,
  };
  const debounced = useDebounced(answers, 400);
  const preview = useQuery({
    queryKey: ["footprint-preview", debounced],
    queryFn: () => api.previewFootprint(debounced),
    enabled: debounced.monthly_kwh > 0,
    placeholderData: (prev) => prev,
  });

  async function save() {
    if (answers.monthly_kwh <= 0) {
      setError(t("join.units"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.saveHousehold({
        ...answers,
        home_type: "apartment",
        ac_count: acs,
        has_geyser: geyser,
        has_washing_machine: washing,
        has_ev: false,
        has_solar: false,
        roof_area_sqm: roof ? num(roof) : null,
      });
      await setItem(GUEST_KEY, null);
      await refresh(); // onboarded is now true, so the navigator moves to the tabs
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown"));
      setBusy(false);
    }
  }

  const fp = preview.data;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} keyboardShouldPersistTaps="handled">
      <Hero eyebrow="Nidhi · 2 min" title={t("onboard.title")} subtitle={t("onboard.sub")} >
        <BrandLogo size={72} />
      </Hero>
      <View style={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: "100%", maxWidth: 560, alignSelf: "center" }}>

        <Rise index={0} style={{ gap: space.sm }}>
          <Pressable
            accessibilityRole="button"
            disabled={scan.state === "busy"}
            onPress={() => pickBill("camera")}
            style={({ pressed }) => [styles.scanBtn, { borderColor: c.border, backgroundColor: c.surface, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <BillScanArt scanning={scan.state === "busy"} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.body, { color: c.text, fontFamily: fonts.bodyBold }]}>{scan.state === "busy" ? t("onboard.scanning") : t("onboard.scan")}</Text>
              <Text style={[type.small, { color: c.muted }]}>{t("onboard.scanHint")}</Text>
            </View>
          </Pressable>
          <Button variant="plain" title={t("onboard.scanGallery")} onPress={() => pickBill("library")} />
          {scan.state === "done" && <Body>{t("onboard.scanned", { kwh: scan.kwh })}</Body>}
          {scan.state === "error" && <ErrorText>{t(scan.message)}</ErrorText>}
        </Rise>

        <Rise index={1} style={[styles.panel, { backgroundColor: c.surface }]}>
          <Stepper label={t("join.units")} value={num(kwh)} onChange={(n) => setKwh(String(n))} step={10} max={5000} suffix="kWh" />
          <Stepper label={t("join.members")} value={num(members, 1)} onChange={(n) => setMembers(String(n))} min={1} max={20} />
          <Stepper label={t("check.acs")} value={acs} onChange={setAcs} max={6} />
        </Rise>
        <Choice label={t("check.discom")} value={company} onChange={setDiscom} options={DISCOMS.map((d) => ({ value: d, label: d.toUpperCase() }))} />
        <Choice label={t("check.area")} value={area} onChange={setArea} options={[{ value: "urban", label: t("check.urban") }, { value: "rural", label: t("check.rural") }]} />
        <Choice label={t("check.geyser")} value={geyser} onChange={setGeyser} options={[{ value: true, label: t("onboard.yes") }, { value: false, label: t("onboard.no") }]} />
        <Choice label={t("join.washing")} value={washing} onChange={setWashing} options={[{ value: true, label: t("onboard.yes") }, { value: false, label: t("onboard.no") }]} />
        <Choice label={t("join.commute")} value={commute} onChange={setCommute} options={COMMUTES.map((m) => ({ value: m, label: t(`commute.${m}` as MessageKey) }))} />
        {commute !== "cycle_walk" && <Field label={t("join.km")} value={km} onChangeText={setKm} keyboardType="numeric" />}
        <Field label={t("join.lpg")} value={lpg} onChangeText={setLpg} keyboardType="numeric" />
        <Field label={t("check.roof")} value={roof} onChangeText={setRoof} keyboardType="numeric" />

        {fp && <Preview total={fp.total_kg} electricity={fp.electricity_kg} cooking={fp.cooking_kg} commute={fp.commute_kg} bill={fp.monthly_bill_rs} />}

        {error && <ErrorText>{error}</ErrorText>}
        <Button title={t("onboard.save")} onPress={save} busy={busy} variant="accent" icon="checkmark-circle-outline" />
      </View>
    </ScrollView>
  );
}

/** The footprint so far, on ink: the total counts to its new value and the three parts fill in. */
function Preview({ total, electricity, cooking, commute, bill }: { total: number; electricity: number; cooking: number; commute: number; bill: number }) {
  const { t } = useI18n();
  const c = useColors();
  const shown = Math.round(useCountUp(total, 600));
  const parts = [
    { kg: electricity, color: c.saffronLight },
    { kg: cooking, color: c.leaf },
    { kg: commute, color: c.skyLight },
  ];
  return (
    <View style={[styles.preview, { backgroundColor: c.primary }]}>
      <Text style={[type.eyebrow, { color: c.onPrimary, opacity: 0.7 }]}>{t("onboard.preview")}</Text>
      {/* Number and unit side by side, each with its own line height: nesting the small unit inside
          the big number made Android clip both. */}
      <View style={styles.total}>
        <Text style={[type.number, styles.totalNumber, { color: c.onPrimary }]}>{shown}</Text>
        <Text style={[styles.totalUnit, { color: c.onPrimary }]}>{t("onboard.perMonth")}</Text>
      </View>
      {parts.map((p, i) => (
        <Bar key={i} value={total > 0 ? p.kg / total : 0} color={p.color} track="rgba(127,127,127,0.25)" height={6} delay={i * 120} />
      ))}
      <Text style={[type.small, { color: c.onPrimary, opacity: 0.8 }]}>{t("onboard.split", { e: Math.round(electricity), c: Math.round(cooking), t: Math.round(commute) })}</Text>
      <Text style={[type.small, { color: c.saffronLight }]}>{t("onboard.bill", { rs: Math.round(bill) })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scanBtn: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: 20, borderWidth: 1, borderStyle: "dashed" },
  panel: { borderRadius: 20, padding: space.lg, gap: space.md },
  preview: { borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  total: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 },
  totalNumber: { lineHeight: 52, includeFontPadding: false },
  totalUnit: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20, opacity: 0.85 },
});
