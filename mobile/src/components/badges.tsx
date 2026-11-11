import { StyleSheet, Text, View } from "react-native";

import { useI18n, type MessageKey } from "@/i18n";
import type { Badge } from "@/lib/api";
import { radius, space, type, useColors } from "@/theme";

/** Earned badges highlighted; the rest show what's left to do. */
export function BadgeList({ badges }: { badges: Badge[] }) {
  const { t } = useI18n();
  const c = useColors();
  return (
    <View style={{ gap: space.sm }}>
      {badges.map((b) => (
        <View key={b.code} style={[styles.badge, { borderColor: b.earned ? c.green : c.border, backgroundColor: b.earned ? c.greenSoft : c.surface }]}>
          <Text style={[type.small, { color: c.text, fontWeight: "700" }]}>
            {b.earned ? "🏅 " : ""}
            {t(`badge.${b.code}` as MessageKey)}
          </Text>
          {!b.earned && (
            <Text style={[type.small, { color: c.muted }]}>
              {t(`badge.${b.code}.how` as MessageKey, { n: b.target })} · {Math.round(b.progress * b.target)}/{b.target}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
});
