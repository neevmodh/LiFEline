// The five tabs of the household app, with icons and a raised tab bar.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { useI18n } from "@/i18n";
import { registerForAlerts } from "@/lib/push";
import { flushQueue } from "@/lib/queue";
import { fonts, useColors } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ["home", "home-outline"],
  act: ["leaf", "leaf-outline"],
  community: ["people", "people-outline"],
  solar: ["sunny", "sunny-outline"],
  me: ["person-circle", "person-circle-outline"],
};

export default function TabsLayout() {
  const { t } = useI18n();
  const c = useColors();
  useSendQueuedLogs();
  useEffect(() => {
    void registerForAlerts();
  }, []);
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.green,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: Platform.OS === "web" ? 64 : undefined,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.bodyBold, fontSize: 11 },
        tabBarIcon: ({ focused, color, size }) => {
          const [on, off] = ICONS[route.name] ?? ["ellipse", "ellipse-outline"];
          return <Ionicons name={focused ? on : off} size={size - 2} color={color as string} />;
        },
      })}
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
