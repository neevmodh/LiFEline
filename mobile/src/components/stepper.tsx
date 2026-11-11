// A number with − and + buttons either side (the middle can still be typed into), and the drawn bill
// with a scan line that sweeps down it, used on the "set up your home" screen.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { tap } from "@/components/motion";
import { fonts, radius, space, type, useColors } from "@/theme";

export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const c = useColors();
  const set = (n: number) => {
    tap();
    onChange(Math.max(min, Math.min(max, n)));
  };
  return (
    <View style={styles.row}>
      <Text style={[type.small, { color: c.text, flex: 1, fontWeight: "600" }]}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} −${step}`} disabled={value <= min} onPress={() => set(value - step)} style={({ pressed }) => [styles.btn, { borderColor: c.border, backgroundColor: c.background, opacity: value <= min ? 0.4 : 1, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
        <Ionicons name="remove" size={20} color={c.text} />
      </Pressable>
      <View style={styles.valueBox}>
        <TextInput
          accessibilityLabel={label}
          value={String(value)}
          onChangeText={(s) => {
            const n = Number(s.replace(/[^0-9]/g, ""));
            if (Number.isFinite(n)) onChange(Math.min(max, n));
          }}
          keyboardType="number-pad"
          style={[styles.value, { color: c.text }]}
        />
        {suffix ? <Text style={[styles.suffix, { color: c.muted }]}>{suffix}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} +${step}`} disabled={value >= max} onPress={() => set(value + step)} style={({ pressed }) => [styles.btn, { borderColor: c.border, backgroundColor: c.background, opacity: value >= max ? 0.4 : 1, transform: [{ scale: pressed ? 0.9 : 1 }] }]}>
        <Ionicons name="add" size={20} color={c.text} />
      </Pressable>
    </View>
  );
}

/** A small drawn bill whose scan line sweeps down while `scanning` (or gently, to invite a tap). */
export function BillScanArt({ scanning }: { scanning: boolean }) {
  const c = useColors();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(withTiming(62, { duration: scanning ? 900 : 2200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, scanning, y]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={[styles.bill, { backgroundColor: c.surfaceAlt }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[46, 34, 40, 28].map((w, i) => (
        <View key={i} style={[styles.billLine, { width: w, top: 10 + i * 10, backgroundColor: c.border }]} />
      ))}
      <Animated.View style={[styles.scan, { backgroundColor: c.saffron }, line]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  btn: { width: 44, height: 44, borderRadius: radius.sm + 2, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  valueBox: { minWidth: 64, alignItems: "center" },
  value: { fontFamily: fonts.display, fontSize: 22, textAlign: "center", minWidth: 56, padding: 0 },
  suffix: { fontSize: 11, fontFamily: fonts.bodyMedium },
  bill: { width: 56, height: 72, borderRadius: 8, overflow: "hidden" },
  billLine: { position: "absolute", left: 6, height: 4, borderRadius: 2 },
  scan: { position: "absolute", left: 0, right: 0, top: 2, height: 2 },
});
