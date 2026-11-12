// Bill X-ray: where the electricity bill comes from, exactly as the DISCOM charges it (slabs, fixed
// charge, fuel surcharge, duty), which slab the last units fall in, and where the units likely go.
// Then "What if": change a habit or add rooftop solar and the bill is recomputed on the spot.
// A fresh bill photo X-rays that month instead of the usual one.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { Columns, usePageWidth } from "@/components/layout";
import { Bar, Rise, useCountUp } from "@/components/motion";
import { Stepper } from "@/components/stepper";
import { Button, ErrorText } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { api, type BillXray } from "@/lib/api";
import { useBillScan } from "@/lib/bill-scan";
import { NO_CHANGE, whatIf, type Levers } from "@/lib/whatif";
import { fonts, shadow, space, type, useColors } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type UseKey = BillXray["uses"][number]["key"];
const USE_ICON: Record<UseKey, IconName> = {
  ac: "snow-outline",
  fridge: "cube-outline",
  lights_fans: "bulb-outline",
  geyser: "water-outline",
  washing: "shirt-outline",
  ev: "car-outline",
  standby: "tv-outline",
  other: "ellipsis-horizontal",
};

export default function Bill() {
  const { t } = useI18n();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const page = usePageWidth();
  const [scanned, setScanned] = useState<number | undefined>(undefined);
  const { scan, pick } = useBillScan((kwh) => setScanned(kwh));
  const x = useQuery({ queryKey: ["bill-xray", scanned ?? "usual"], queryFn: () => api.billXray(scanned) });

  const left = x.data ? (
    <>
      <Total x={x.data} scanned={scanned !== undefined} />
      <Slabs x={x.data} />
    </>
  ) : null;
  const right = x.data ? (
    <>
      <Uses x={x.data} />
      <Simulator x={x.data} />
    </>
  ) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={[styles.page, page, { paddingTop: insets.top + space.md }]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.back")}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
          style={[styles.back, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: c.text, fontSize: 24 }]}>{t("bill.title")}</Text>
          <Text style={[type.small, { color: c.muted }]}>{t("bill.sub")}</Text>
        </View>
      </View>
      <Button variant="plain" icon="camera-outline" title={scan.state === "busy" ? t("onboard.scanning") : t("bill.scan")} busy={scan.state === "busy"} onPress={() => void pick("camera")} />
      {scan.state === "error" && <ErrorText>{t(scan.message)}</ErrorText>}
      {x.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}
      {x.data && <Columns left={left} right={right} ratio={1} />}
    </ScrollView>
  );
}

function Total({ x, scanned }: { x: BillXray; scanned: boolean }) {
  const { t } = useI18n();
  const c = useColors();
  const total = Math.round(useCountUp(x.total_rs, 900));
  const parts = [
    { key: "bill.energy", rs: x.energy_rs, color: c.saffronLight },
    { key: "bill.fppas", rs: x.fppas_rs, color: c.clayLight },
    { key: "bill.duty", rs: x.duty_rs, color: c.skyLight },
    { key: "bill.fixed", rs: x.fixed_rs, color: c.leaf },
  ] as const;
  return (
    <Rise index={0} style={[styles.hero, { backgroundColor: c.primary }]}>
      <Text style={[type.eyebrow, { color: c.onPrimary, opacity: 0.7 }]}>{scanned ? t("bill.thisBill") : t("bill.usual")}</Text>
      <Text style={[styles.big, { color: c.onPrimary }]}>₹{total.toLocaleString("en-IN")}</Text>
      <Text style={[type.small, { color: c.onPrimary, opacity: 0.85 }]}>{t("bill.forUnits", { kwh: Math.round(x.kwh) })}</Text>
      <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {parts.map((p) => (
          <View key={p.key} style={{ flex: Math.max(p.rs, 0.01), backgroundColor: p.color }} />
        ))}
      </View>
      <View style={styles.legendGrid}>
        {parts.map((p) => (
          <View key={p.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: p.color }]} />
            <Text style={[type.small, { color: c.onPrimary }]}>{`${t(p.key)} ₹${Math.round(p.rs).toLocaleString("en-IN")}`}</Text>
          </View>
        ))}
      </View>
    </Rise>
  );
}

function Slabs({ x }: { x: BillXray }) {
  const { t } = useI18n();
  const c = useColors();
  let from = 0;
  const lastUsed = x.slabs.reduce((last, s, i) => (s.units > 0 ? i : last), 0);
  return (
    <Rise index={1} style={[styles.card, shadow, { backgroundColor: c.surface }]}>
      <Text style={[type.heading, { color: c.text }]}>{t("bill.slabs")}</Text>
      <Text style={[type.small, { color: c.muted }]}>{t("bill.slabsSub")}</Text>
      {x.slabs.map((s, i) => {
        const size = s.upto === null ? null : s.upto - from;
        const label = s.upto === null ? t("bill.slabOver", { from: Math.round(from) }) : t("bill.slabRange", { from: Math.round(from), to: Math.round(s.upto) });
        from = s.upto ?? from;
        const here = i === lastUsed;
        return (
          <View key={i} style={[styles.slab, here && { backgroundColor: c.saffronSoft }]}>
            <View style={styles.slabHead}>
              <Text style={[type.small, { color: c.text, fontFamily: here ? fonts.bodyBold : fonts.bodyMedium, flex: 1 }]}>{label}</Text>
              <Text style={[type.small, { color: here ? c.saffronInk : c.muted, fontFamily: fonts.bodyBold }]}>{`₹${s.rate.toFixed(2)}/${t("bill.unit")}`}</Text>
            </View>
            <Bar value={size ? s.units / size : s.units > 0 ? 1 : 0} height={7} color={here ? c.saffron : c.green} delay={200 + i * 100} />
            <Text style={[styles.slabFoot, { color: c.muted }]}>{s.units > 0 ? t("bill.slabUse", { units: Math.round(s.units), rs: Math.round(s.rs).toLocaleString("en-IN") }) : t("bill.slabUnused")}</Text>
          </View>
        );
      })}
      <Text style={[type.small, { color: c.text }]}>{t("bill.topRate", { rate: x.top_rate.toFixed(2) })}</Text>
      {x.slab_units_over !== null && x.slab_rs_if_cut !== null && (
        <View style={[styles.tip, { backgroundColor: c.greenSoft }]}>
          <Ionicons name="trending-down" size={18} color={c.greenDeep} />
          <Text style={[type.small, { color: c.greenDeep, flex: 1, fontFamily: fonts.bodyBold }]}>
            {t("bill.slabTip", { units: Math.round(x.slab_units_over), rs: Math.round(x.slab_rs_if_cut).toLocaleString("en-IN") })}
          </Text>
        </View>
      )}
    </Rise>
  );
}

function Uses({ x }: { x: BillXray }) {
  const { t } = useI18n();
  const c = useColors();
  const palette = [c.saffron, c.green, c.sky, c.clay, c.leaf, c.saffronLight, c.skyLight, c.border];
  const total = Math.max(1, x.uses.reduce((s, u) => s + u.kwh, 0));
  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <Rise index={2} style={[styles.card, shadow, { backgroundColor: c.surface }]}>
      <Text style={[type.heading, { color: c.text }]}>{t("bill.uses")}</Text>
      <View style={styles.usesRow}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width={140} height={140} viewBox="0 0 140 140">
          <Circle cx={70} cy={70} r={R} stroke={c.track} strokeWidth={22} fill="none" />
          {x.uses.map((u, i) => {
            const len = (u.kwh / total) * C;
            const el = (
              <Circle
                key={u.key}
                cx={70}
                cy={70}
                r={R}
                stroke={palette[i % palette.length]}
                strokeWidth={22}
                fill="none"
                strokeDasharray={`${Math.max(len - 2, 0.1)} ${C}`}
                strokeDashoffset={-offset}
                rotation={-90}
                origin="70, 70"
              />
            );
            offset += len;
            return el;
          })}
        </Svg>
        </View>
        <View style={{ flex: 1, gap: 6, minWidth: 150 }}>
          {x.uses.map((u, i) => (
            <View key={u.key} style={styles.useItem}>
              <View style={[styles.swatch, { backgroundColor: palette[i % palette.length] }]} />
              <Ionicons name={USE_ICON[u.key]} size={15} color={c.muted} />
              <Text style={[type.small, { color: c.text, flex: 1 }]}>{t(`bill.use.${u.key}` as MessageKey)}</Text>
              <Text style={[type.small, { color: c.muted }]}>{`${Math.round((u.kwh / total) * 100)}%`}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={[styles.slabFoot, { color: c.muted }]}>{t("bill.usesNote")}</Text>
    </Rise>
  );
}

function Simulator({ x }: { x: BillXray }) {
  const { t } = useI18n();
  const c = useColors();
  const [l, setL] = useState<Levers>(NO_CHANGE);
  const w = whatIf(x, l);
  const saved = Math.round(useCountUp(w.savedRs, 500));
  const set = <K extends keyof Levers>(k: K, v: Levers[K]) => setL((old) => ({ ...old, [k]: v }));
  return (
    <Rise index={3} style={[styles.card, shadow, { backgroundColor: c.surface }]}>
      <Text style={[type.heading, { color: c.text }]}>{t("whatif.title")}</Text>
      <Text style={[type.small, { color: c.muted }]}>{t("whatif.sub")}</Text>
      {x.levers.ac_kwh_per_degree > 0 && <Stepper label={t("whatif.ac")} value={l.acDegrees} onChange={(n) => set("acDegrees", n)} min={0} max={4} suffix="°C" />}
      <Stepper label={t("whatif.leds")} value={l.leds} onChange={(n) => set("leds", n)} min={0} max={10} />
      <Stepper label={t("whatif.solar")} value={l.solarKw} onChange={(n) => set("solarKw", n)} step={0.5} min={0} max={5} suffix="kW" />
      {x.levers.geyser_kwh > 0 && <Toggle label={t("whatif.geyser")} value={l.geyserOff} onChange={(v) => set("geyserOff", v)} />}
      <Toggle label={t("whatif.standby")} value={l.standbyOff} onChange={(v) => set("standbyOff", v)} />
      <View style={[styles.result, { backgroundColor: w.savedRs > 0 ? c.greenSoft : c.surfaceAlt }]} accessibilityLiveRegion="polite">
        <Text style={[type.eyebrow, { color: c.greenDeep }]}>{t("whatif.youSave")}</Text>
        <Text style={[styles.saved, { color: c.greenDeep }]}>{t("whatif.perMonth", { rs: saved.toLocaleString("en-IN") })}</Text>
        <Text style={[type.small, { color: c.text }]}>{t("whatif.newBill", { rs: w.billRs.toLocaleString("en-IN"), kwh: w.kwh })}</Text>
        <Text style={[type.small, { color: c.muted }]}>{t("whatif.co2", { kg: w.savedKgMonth, trees: w.treesYear })}</Text>
      </View>
    </Rise>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useColors();
  return (
    <View style={styles.toggle}>
      <Text style={[type.small, { color: c.text, flex: 1, fontWeight: "600" }]}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: c.green, false: c.track }} thumbColor={c.surface} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2, gap: space.md },
  top: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.xs },
  back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: 22, padding: space.lg, gap: 6 },
  big: { fontFamily: fonts.display, fontSize: 48, lineHeight: 56, letterSpacing: -1.5 },
  stack: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", marginTop: space.sm, gap: 2 },
  legendGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: "45%" },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  card: { borderRadius: 22, padding: space.lg, gap: space.sm },
  slab: { gap: 5, padding: space.sm, borderRadius: 12, marginHorizontal: -space.sm },
  slabHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  slabFoot: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15 },
  tip: { flexDirection: "row", gap: space.sm, alignItems: "center", padding: space.md, borderRadius: 14 },
  usesRow: { flexDirection: "row", alignItems: "center", gap: space.lg, flexWrap: "wrap" },
  useItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  result: { borderRadius: 16, padding: space.md, gap: 4, marginTop: space.xs },
  saved: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36 },
});
