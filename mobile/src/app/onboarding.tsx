// A two-minute start: a bill photo fills in the units and the electricity company, the district
// suggests the company when there's no photo, and the footprint preview updates as you answer.
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { Body, BigNumber, Button, Card, Choice, ErrorText, Field, Hero } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { api, ApiError, type CommuteMode, type Discom, type TariffArea } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useSession } from "@/lib/session";
import { getItem, setItem } from "@/lib/storage";
import { space, useColors } from "@/theme";

const DISCOMS: Discom[] = ["dgvcl", "mgvcl", "pgvcl", "ugvcl", "torrent"];
const COMMUTES: CommuteMode[] = ["two_wheeler", "car", "bus", "metro", "cycle_walk"];
/** Answers from the free bill check (same shape the web app stores), so nothing is typed twice. */
const GUEST_KEY = "nidhi.guest";

type Scan = { state: "idle" | "busy" } | { state: "done"; kwh: number } | { state: "error"; message: MessageKey };

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
  const [scan, setScan] = useState<Scan>({ state: "idle" });
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

  async function pickBill(source: "camera" | "library") {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return pickBill("library");
    }
    const res = source === "camera" ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    setScan({ state: "busy" });
    try {
      const bill = await api.scanBill(res.assets[0]);
      const monthly = bill.monthly_kwh ?? bill.units_kwh;
      if (!monthly) throw new ApiError(422, "unreadable");
      setKwh(String(Math.round(monthly)));
      const d = bill.distributor?.toLowerCase();
      if (d && (DISCOMS as string[]).includes(d)) setDiscom(d as Discom);
      setScan({ state: "done", kwh: Math.round(monthly) });
    } catch (e) {
      setScan({ state: "error", message: e instanceof ApiError && e.status === 503 ? "onboard.scanUnavailable" : "onboard.scanFailed" });
    }
  }

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
      <Hero eyebrow="Nidhi · 2 min" title={t("onboard.title")} subtitle={t("onboard.sub")} />
      <View style={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: "100%", maxWidth: 560, alignSelf: "center" }}>

        <Card tone="saffron">
          <Button title={scan.state === "busy" ? t("onboard.scanning") : t("onboard.scan")} busy={scan.state === "busy"} onPress={() => pickBill("camera")} icon="camera-outline" />
          <Button variant="plain" title={t("onboard.scanGallery")} onPress={() => pickBill("library")} />
          {scan.state === "done" && <Body>{t("onboard.scanned", { kwh: scan.kwh })}</Body>}
          {scan.state === "error" && <ErrorText>{t(scan.message)}</ErrorText>}
        </Card>

        <Field label={t("join.units")} value={kwh} onChangeText={setKwh} keyboardType="numeric" />
        <Choice label={t("check.discom")} value={company} onChange={setDiscom} options={DISCOMS.map((d) => ({ value: d, label: d.toUpperCase() }))} />
        <Choice label={t("check.area")} value={area} onChange={setArea} options={[{ value: "urban", label: t("check.urban") }, { value: "rural", label: t("check.rural") }]} />
        <Field label={t("join.members")} value={members} onChangeText={setMembers} keyboardType="number-pad" />
        <Choice label={t("check.acs")} value={acs} onChange={setAcs} options={[0, 1, 2, 3].map((n) => ({ value: n, label: n === 3 ? "3+" : String(n) }))} />
        <Choice label={t("check.geyser")} value={geyser} onChange={setGeyser} options={[{ value: true, label: t("onboard.yes") }, { value: false, label: t("onboard.no") }]} />
        <Choice label={t("join.washing")} value={washing} onChange={setWashing} options={[{ value: true, label: t("onboard.yes") }, { value: false, label: t("onboard.no") }]} />
        <Choice label={t("join.commute")} value={commute} onChange={setCommute} options={COMMUTES.map((m) => ({ value: m, label: t(`commute.${m}` as MessageKey) }))} />
        {commute !== "cycle_walk" && <Field label={t("join.km")} value={km} onChangeText={setKm} keyboardType="numeric" />}
        <Field label={t("join.lpg")} value={lpg} onChangeText={setLpg} keyboardType="numeric" />
        <Field label={t("check.roof")} value={roof} onChangeText={setRoof} keyboardType="numeric" />

        {fp && (
          <Card tone="green">
            <Body muted>{t("onboard.preview")}</Body>
            <BigNumber color={c.green}>{Math.round(fp.total_kg)}</BigNumber>
            <Body>{t("onboard.perMonth")}</Body>
            <Body muted>{t("onboard.split", { e: Math.round(fp.electricity_kg), c: Math.round(fp.cooking_kg), t: Math.round(fp.commute_kg) })}</Body>
            <Body muted>{t("onboard.bill", { rs: Math.round(fp.monthly_bill_rs) })}</Body>
          </Card>
        )}

        {error && <ErrorText>{error}</ErrorText>}
        <Button title={t("onboard.save")} onPress={save} busy={busy} variant="accent" icon="checkmark-circle-outline" />
      </View>
    </ScrollView>
  );
}
