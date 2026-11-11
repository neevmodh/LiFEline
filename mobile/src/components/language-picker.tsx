import { Pressable, StyleSheet, Text, View } from "react-native";

import { LOCALES, useI18n } from "@/i18n";
import { radius, space, type, useColors } from "@/theme";

export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n();
  const c = useColors();
  return (
    <View accessibilityLabel={t("common.language")} style={styles.row}>
      {LOCALES.map((l) => {
        const on = l.code === locale;
        return (
          <Pressable
            key={l.code}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => setLocale(l.code)}
            style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : "transparent" }]}
          >
            <Text style={[type.small, { color: on ? c.onPrimary : c.text }]}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.xs + 2, minHeight: 36, justifyContent: "center" },
});
