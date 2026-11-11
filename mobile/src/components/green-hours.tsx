// Today as a bar from 6 AM to midnight: the Green Hours (solar) window in saffron, the evening peak
// hatched in clay, and a blinking marker for now (India time).
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import type { GreenHours } from "@/lib/api";
import { space, type, useColors } from "@/theme";

const FROM = 6;
const TO = 24;
const pct = (h: number) => `${(Math.max(0, Math.min(TO - FROM, h - FROM)) / (TO - FROM)) * 100}%` as const;
const label = (h: number) => `${((h + 11) % 12) + 1}${h < 12 || h === 24 ? " AM" : " PM"}`;

function istHour(): number {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60_000);
  return ist.getHours() + ist.getMinutes() / 60;
}

export function GreenHoursBar({ data, title, solarLabel, peakLabel }: { data: GreenHours; title: string; solarLabel: string; peakLabel: string }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const blink = useSharedValue(1);
  useEffect(() => {
    if (!reduced) blink.value = withRepeat(withTiming(0.3, { duration: 1000 }), -1, true);
  }, [reduced, blink]);
  const nowStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  const win = data.today ?? null;
  const [peakFrom, peakTo] = data.peak_hours;
  const now = istHour();
  return (
    <View style={[styles.box, { backgroundColor: c.saffronSoft }]}>
      <Text style={[type.small, { color: c.saffronInk, fontWeight: "700" }]}>{title}</Text>
      <View style={[styles.bar, { backgroundColor: "#EAD5B8" }]}>
        {win && <View style={[styles.span, { left: pct(win.start_hour), width: pct(FROM + (win.end_hour - win.start_hour)), backgroundColor: c.saffron }]} />}
        <View style={[styles.span, { left: pct(peakFrom), width: pct(FROM + (peakTo - peakFrom)), backgroundColor: c.clay, opacity: 0.75 }]} />
        {now >= FROM && <Animated.View style={[styles.now, { left: pct(now), backgroundColor: c.ink }, nowStyle]} />}
      </View>
      <View style={styles.labels}>
        <Text style={[styles.tick, { color: c.saffronInk }]}>6 AM</Text>
        {win && <Text style={[styles.tick, { color: c.saffronInk }]}>{solarLabel} {label(win.start_hour)}–{label(win.end_hour)}</Text>}
        <Text style={[styles.tick, { color: c.saffronInk }]}>{peakLabel} {label(peakFrom)}–{label(peakTo)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 20, padding: space.md + 2, gap: space.sm },
  bar: { height: 24, borderRadius: 8, overflow: "hidden" },
  span: { position: "absolute", top: 0, bottom: 0 },
  now: { position: "absolute", top: 0, bottom: 0, width: 3, borderRadius: 2, marginLeft: -1 },
  labels: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4 },
  tick: { fontSize: 11, fontFamily: "Inter_500Medium" },
});
