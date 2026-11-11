// Welcome: the first thing a signed-out person sees. The sun rises over the rooftops, the language
// can be switched on the spot, and two ways in: start fresh or sign in.
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { SunriseScene } from "@/components/illustrations";
import { useI18n, LOCALES } from "@/i18n";
import { fonts, radius, space, type, useColors } from "@/theme";

export default function Welcome() {
  const { t, locale, setLocale } = useI18n();
  const c = useColors();
  const router = useRouter();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ flexGrow: 1 }}>
      <SunriseScene height={400} />
      <View style={styles.body}>
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.langs} accessibilityRole="radiogroup">
          {LOCALES.map((l) => {
            const on = l.code === locale;
            return (
              <Pressable
                key={l.code}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setLocale(l.code)}
                style={[styles.lang, { backgroundColor: on ? c.primary : "transparent", borderColor: on ? c.primary : c.border }]}
              >
                <Text style={[type.small, { color: on ? c.onPrimary : c.text, fontWeight: "600" }]}>{l.label}</Text>
              </Pressable>
            );
          })}
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(550).duration(500)} style={{ gap: space.sm }}>
          <Text style={[type.title, styles.title, { color: c.text }]}>{t("welcome.title")}</Text>
          <Text style={[type.body, { color: c.muted }]}>{t("welcome.sub")}</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(700).duration(500)} style={styles.actions}>
          <Pressable onPress={() => router.push("/sign-up")} accessibilityRole="link" style={({ pressed }) => [styles.primary, { backgroundColor: c.primary, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <Text style={[styles.primaryText, { color: c.onPrimary }]}>{t("welcome.start")} →</Text>
            </Pressable>
          <Pressable onPress={() => router.push("/sign-in")} accessibilityRole="link" style={({ pressed }) => [styles.secondary, { borderColor: c.border, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
              <Text style={[styles.secondaryText, { color: c.text }]}>{t("welcome.have")}</Text>
            </Pressable>
          <Text style={[type.small, { color: c.muted, textAlign: "center" }]}>{t("welcome.with")}</Text>
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: space.xl, paddingTop: space.md, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" },
  langs: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  lang: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  title: { fontSize: 38, lineHeight: 42 },
  actions: { marginTop: "auto", gap: space.sm },
  primary: { minHeight: 56, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  primaryText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  secondary: { minHeight: 52, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: fonts.bodyBold, fontSize: 15 },
});
