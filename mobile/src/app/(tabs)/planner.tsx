// Appliance planner: when to run the washing machine, geyser, iron, pump or EV today. Each hour is
// coloured by how clean the grid is likely to be, from the district's live solar forecast and the
// evening peak; pick a start time and see the kg CO₂, whether it hits the peak, and the cleanest time.
// Running a heavy load outside the peak can be logged straight away.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Celebration } from "@/components/celebration";
import { usePageWidth } from "@/components/layout";
import { Rise, tap } from "@/components/motion";
import { ErrorText } from "@/components/ui";
import { districtName, useI18n, type MessageKey } from "@/i18n";
import { api } from "@/lib/api";
import { useLogAction } from "@/lib/log-action";
import { appliancesFor, bestStart, hourlyIndex, kgPerRun, touchesPeak, type Appliance } from "@/lib/planner";
import { hourLabel } from "@/lib/solar-view";
import { useSession } from "@/lib/session";
import { fonts, shadow, space, type, useColors } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const ICON: Record<Appliance["code"], IconName> = { washing: "shirt-outline", geyser: "water-outline", iron: "flame-outline", pump: "funnel-outline", ev: "car-sport-outline" };

export default function Planner() {
  const { t, locale } = useI18n();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const page = usePageWidth(true);
  const { user } = useSession();
  const home = useQuery({ queryKey: ["household"], queryFn: api.household });
  const today = useQuery({ queryKey: ["solar-today", user?.district_id], queryFn: () => api.solarToday(user?.district_id as number), enabled: !!user?.district_id, staleTime: 30 * 60_000 });
  const index = hourlyIndex(today.data?.hours ?? {});
  const list = home.data ? appliancesFor(home.data.household) : [];
  const logger = useLogAction();

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={[styles.page, page, { paddingTop: insets.top + space.md }]}>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))} style={[styles.back, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[type.title, { color: c.text, fontSize: 24 }]}>{t("planner.title")}</Text>
            <Text style={[type.small, { color: c.muted }]}>
              {today.data && today.data.sky !== "unknown" ? t("planner.sub", { district: districtName(locale, today.data.district) }) : t("planner.subNoSun")}
            </Text>
          </View>
        </View>
        <View style={styles.legend}>
          <Swatch color={c.green} label={t("planner.clean")} />
          <Swatch color={c.track} label={t("planner.average")} />
          <Swatch color={c.clay} label={t("planner.peak")} />
        </View>
        {logger.error && <ErrorText>{logger.error}</ErrorText>}
        {list.map((a, i) => (
          <Rise key={a.code} index={i}>
            <ApplianceRow a={a} index={index} onLog={() => logger.logNow({ code: "shift_heavy_load", title: t(`planner.app.${a.code}` as MessageKey), fullPoints: 0 })} busy={logger.busy} />
          </Rise>
        ))}
        <Text style={[type.small, { color: c.muted }]}>{t("planner.note")}</Text>
      </ScrollView>
      <Celebration info={logger.celebration} onClose={logger.closeCelebration} />
    </View>
  );
}

function ApplianceRow({ a, index, onLog, busy }: { a: Appliance; index: number[]; onLog: () => void; busy: boolean }) {
  const { t } = useI18n();
  const c = useColors();
  const best = bestStart(index, a);
  const [start, setStart] = useState(19); // the habit Nidhi wants to move: the evening
  const peak = touchesPeak(start, a.hours);
  const kg = kgPerRun(index, a, start);
  const bestKg = kgPerRun(index, a, best);
  const colour = (h: number) => (index[h] >= 1.08 ? c.clay : index[h] <= 0.85 ? c.green : index[h] <= 0.95 ? c.leaf : c.track);
  const name = t(`planner.app.${a.code}` as MessageKey);
  return (
    <View style={[styles.card, shadow, { backgroundColor: c.surface }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: c.saffronSoft }]}>
          <Ionicons name={ICON[a.code]} size={20} color={c.saffronInk} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text }]}>{name}</Text>
          <Text style={[type.small, { color: c.muted }]}>{t("planner.spec", { kw: a.kw, h: a.hours })}</Text>
        </View>
      </View>
      <View style={styles.hours} accessibilityLabel={t("planner.pick", { name })}>
        {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => {
          const on = h >= start && h < start + a.hours;
          return (
            <Pressable
              key={h}
              accessibilityRole="button"
              accessibilityState={{ selected: h === start }}
              accessibilityLabel={hourLabel(h)}
              onPress={() => {
                tap();
                setStart(h);
              }}
              style={[styles.hour, { backgroundColor: colour(h), borderColor: on ? c.primary : "transparent" }]}
            >
              <Text style={[styles.hourText, { color: index[h] >= 1.08 || index[h] <= 0.85 ? c.onPrimary : c.text }]}>{hourLabel(h).replace(" ", "")}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.result} accessibilityLiveRegion="polite">
        <Text style={[type.small, { color: peak ? c.clay : c.greenDeep, fontFamily: fonts.bodyBold, flex: 1 }]}>
          {peak ? t("planner.inPeak", { hour: hourLabel(start), kg }) : t("planner.offPeak", { hour: hourLabel(start), kg })}
        </Text>
      </View>
      {best !== start && (
        <Pressable accessibilityRole="button" onPress={() => setStart(best)} style={[styles.best, { backgroundColor: c.greenSoft }]}>
          <Ionicons name="leaf-outline" size={16} color={c.greenDeep} />
          <Text style={[type.small, { color: c.greenDeep, flex: 1 }]}>{t("planner.best", { hour: hourLabel(best), kg: bestKg, save: Math.max(0, Math.round((kg - bestKg) * 100) / 100) })}</Text>
        </Pressable>
      )}
      {!peak && (a.code === "washing" || a.code === "geyser" || a.code === "ev") && (
        <Pressable accessibilityRole="button" disabled={busy} onPress={onLog} style={({ pressed }) => [styles.log, { backgroundColor: c.primary, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
          <Ionicons name="checkmark" size={16} color={c.onPrimary} />
          <Text style={[styles.logText, { color: c.onPrimary }]}>{t("planner.log")}</Text>
        </Pressable>
      )}
    </View>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  const c = useColors();
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={[type.small, { color: c.muted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2, gap: space.md },
  top: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.xs },
  back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  swatchRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  card: { borderRadius: 20, padding: space.md, gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.bodyBold, fontSize: 15 },
  // The whole day wraps onto rows, so the chosen hour is always in view.
  hours: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingVertical: 2 },
  hour: { width: 46, height: 38, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  hourText: { fontFamily: fonts.bodyBold, fontSize: 10 },
  result: { flexDirection: "row", alignItems: "center", gap: space.sm },
  best: { flexDirection: "row", alignItems: "center", gap: 6, padding: space.sm, borderRadius: 12 },
  log: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, minHeight: 38, borderRadius: 12 },
  logText: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
