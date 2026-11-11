// The five tabs of the household app. Screens other than Home and Me are filled in by later issues.
import { useQueryClient } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";

import { useI18n } from "@/i18n";
import { flushQueue } from "@/lib/queue";
import { useColors } from "@/theme";

export default function TabsLayout() {
  const { t } = useI18n();
  const c = useColors();
  useSendQueuedLogs();
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

/** Send actions saved while offline: on opening, when the app comes back to the front, and every minute. */
function useSendQueuedLogs() {
  const qc = useQueryClient();
  useEffect(() => {
    const send = () =>
      flushQueue().then((n) => {
        if (n > 0) qc.invalidateQueries();
      });
    send();
    const sub = AppState.addEventListener("change", (s) => s === "active" && send());
    const id = setInterval(send, 60_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, [qc]);
}
