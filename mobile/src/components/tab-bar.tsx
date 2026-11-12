// The household app's navigation. On a phone: a bottom bar with Home, Quests, a raised button to log
// an action, Team and Me, kept clear of the system's gesture bar. On a wide browser window: a sidebar.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandLogo } from "@/components/brand";
import { tap } from "@/components/motion";
import { LOCALES, useI18n, type MessageKey } from "@/i18n";
import { fonts, shadow, space, useColors } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const ITEMS: { name: string; label: MessageKey; icon: [IconName, IconName] }[] = [
  { name: "index", label: "nav.home", icon: ["home", "home-outline"] },
  { name: "quests", label: "nav.quests", icon: ["trophy", "trophy-outline"] },
  { name: "act", label: "nav.log", icon: ["add", "add"] },
  { name: "community", label: "nav.team", icon: ["people", "people-outline"] },
  { name: "me", label: "tab.me", icon: ["person-circle", "person-circle-outline"] },
];
const SIDEBAR_EXTRA: typeof ITEMS = [{ name: "solar", label: "nav.solar", icon: ["sunny", "sunny-outline"] }];

/** Android reports no inset for 3-button navigation; keep a little air under the labels anyway. */
const MIN_BOTTOM = Platform.OS === "android" ? 8 : Platform.OS === "web" ? 6 : 0;

export function NidhiTabBar({ state, emitter, navigateToTab, wide }: BottomTabBarProps & { wide: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    tap();
    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (current !== name && !event.defaultPrevented) navigateToTab(route.key);
  };

  if (wide) {
    return (
      <View style={[styles.side, { backgroundColor: c.surface, borderRightColor: c.border }]} accessibilityRole="tablist">
        <View style={styles.brand}>
          <BrandLogo size={44} />
          <Text style={[styles.brandName, { color: c.text }]}>Nidhi</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => go("act")}
          style={({ pressed }) => [styles.sideLog, shadow, { backgroundColor: c.primary, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
        >
          <Ionicons name="add" size={22} color={c.onPrimary} />
          <Text style={[styles.sideLogText, { color: c.onPrimary }]}>{t("nav.log")}</Text>
        </Pressable>
        <View style={{ gap: 4 }}>
          {[...ITEMS.filter((i) => i.name !== "act"), ...SIDEBAR_EXTRA].map((item) => {
            const on = current === item.name;
            return (
              <Pressable
                key={item.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => go(item.name)}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.sideItem,
                  { backgroundColor: on ? c.greenSoft : hovered || pressed ? c.surfaceAlt : "transparent" },
                ]}
              >
                <Ionicons name={on ? item.icon[0] : item.icon[1]} size={22} color={on ? c.greenDeep : c.muted} />
                <Text style={[styles.sideLabel, { color: on ? c.greenDeep : c.text }]}>{t(item.label)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.sideFootBox}>
          <View style={[styles.langs, { backgroundColor: c.surfaceAlt }]} accessibilityRole="radiogroup" accessibilityLabel={t("common.language")}>
            {LOCALES.map((l) => (
              <Pressable
                key={l.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: locale === l.code }}
                onPress={() => setLocale(l.code)}
                style={[styles.lang, { backgroundColor: locale === l.code ? c.surface : "transparent" }]}
              >
                <Text style={[styles.langText, { color: locale === l.code ? c.text : c.muted }]}>{l.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.sideFoot, { color: c.muted }]}>{t("welcome.with")}</Text>
        </View>
      </View>
    );
  }

  const bottom = Math.max(insets.bottom, MIN_BOTTOM);
  return (
    <View style={[styles.bar, { paddingBottom: bottom, height: 62 + bottom, backgroundColor: c.surface, borderTopColor: c.border }]} accessibilityRole="tablist">
      {ITEMS.map((item) => {
        const on = current === item.name;
        if (item.name === "act") {
          return (
            <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={t(item.label)} onPress={() => go("act")} style={styles.slot} hitSlop={6}>
              {({ pressed }) => (
                <View style={[styles.raised, shadow, { backgroundColor: c.primary, transform: [{ rotate: "-6deg" }, { scale: pressed ? 0.92 : 1 }] }]}>
                  <Ionicons name="add" size={30} color={c.onPrimary} />
                </View>
              )}
            </Pressable>
          );
        }
        return (
          <Pressable
            key={item.name}
            accessibilityRole="tab"
            accessibilityLabel={t(item.label)}
            accessibilityState={{ selected: on }}
            onPress={() => go(item.name)}
            style={styles.slot}
          >
            <Ionicons name={on ? item.icon[0] : item.icon[1]} size={23} color={on ? c.text : c.muted} />
            <Text numberOfLines={1} style={[styles.label, { color: on ? c.text : c.muted }]}>
              {t(item.label)}
            </Text>
            <View style={[styles.underline, { backgroundColor: on ? c.saffron : "transparent" }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: 1, paddingTop: 6, overflow: "visible" },
  slot: { flex: 1, alignItems: "center", justifyContent: "flex-start", gap: 2, paddingTop: 2, minHeight: 50 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 15 },
  underline: { width: 16, height: 3, borderRadius: 2, marginTop: 1 },
  raised: { width: 56, height: 56, borderRadius: 20, marginTop: -24, alignItems: "center", justifyContent: "center" },
  side: { width: 248, borderRightWidth: 1, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.lg, gap: space.lg },
  brand: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: 6 },
  brandName: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.5 },
  sideLog: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 50, borderRadius: 16 },
  sideLogText: { fontFamily: fonts.bodyBold, fontSize: 15 },
  sideItem: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 46, paddingHorizontal: space.md, borderRadius: 14 },
  sideLabel: { fontFamily: fonts.bodyBold, fontSize: 15 },
  sideFootBox: { marginTop: "auto", gap: space.md },
  sideFoot: { fontSize: 12, lineHeight: 17, fontFamily: fonts.bodyMedium, paddingHorizontal: 6 },
  langs: { flexDirection: "row", borderRadius: 14, padding: 3 },
  lang: { flex: 1, minHeight: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  langText: { fontFamily: fonts.bodyBold, fontSize: 12 },
});
