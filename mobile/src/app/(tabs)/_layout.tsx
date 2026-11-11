// The five tabs of the household app. Screens other than Home and Me are filled in by later issues.
import { Tabs } from "expo-router";

import { useI18n } from "@/i18n";
import { useColors } from "@/theme";

export default function TabsLayout() {
  const { t } = useI18n();
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
        tabBarIconStyle: { display: "none" },
        tabBarLabelPosition: "below-icon",
        tabBarItemStyle: { justifyContent: "center", paddingHorizontal: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("nav.home") }} />
      <Tabs.Screen name="act" options={{ title: t("nav.actions") }} />
      <Tabs.Screen name="community" options={{ title: t("nav.community") }} />
      <Tabs.Screen name="solar" options={{ title: t("nav.solar") }} />
      <Tabs.Screen name="me" options={{ title: t("tab.me") }} />
    </Tabs>
  );
}
