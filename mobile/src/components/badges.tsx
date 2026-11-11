// Badges as medallions: earned ones in colour, popping in one after another; the rest dashed, with a
// lock and how far along they are.
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";

import { useI18n, type MessageKey } from "@/i18n";
import type { Badge } from "@/lib/api";
import { fonts, space, useColors } from "@/theme";

export function BadgeList({ badges }: { badges: Badge[] }) {
  const { t } = useI18n();
  const c = useColors();
  const tones = [
    [c.saffronLight, "#5B3A12"],
    [c.leaf, "#1F3A29"],
    [c.skyLight, "#1F3550"],
    [c.clayLight, "#6B3524"],
  ];
  const sorted = [...badges].sort((a, b) => Number(b.earned) - Number(a.earned));
  return (
    <View style={styles.grid}>
      {sorted.map((b, i) => {
        const [bg, ink] = tones[i % tones.length];
        const name = t(`badge.${b.code}` as MessageKey);
        const done = Math.round(b.progress * b.target);
        return (
          <Animated.View
            key={b.code}
            entering={ZoomIn.delay(120 + i * 60).springify().damping(12)}
            style={styles.cell}
            accessibilityLabel={b.earned ? name : `${name}, ${done}/${b.target}`}
          >
            {b.earned ? (
              <View style={[styles.medal, { backgroundColor: bg, borderBottomColor: ink }]}>
                <Ionicons name="ribbon" size={26} color={ink} />
              </View>
            ) : (
              <View style={[styles.medal, styles.locked, { borderColor: c.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={c.muted} />
              </View>
            )}
            <Text style={[styles.name, { color: b.earned ? c.text : c.muted }]} numberOfLines={2}>
              {name}
            </Text>
            {!b.earned && (
              <Text style={[styles.how, { color: c.muted }]} numberOfLines={2}>
                {done}/{b.target}
              </Text>
            )}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.md },
  cell: { width: "25%", alignItems: "center", gap: 4, paddingHorizontal: 2 },
  medal: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", borderBottomWidth: 4 },
  locked: { borderWidth: 2, borderStyle: "dashed", borderBottomWidth: 2 },
  name: { fontFamily: fonts.bodyBold, fontSize: 11, textAlign: "center" },
  how: { fontFamily: fonts.bodyMedium, fontSize: 10, textAlign: "center" },
});
