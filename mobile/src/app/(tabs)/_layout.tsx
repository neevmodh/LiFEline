// The household app's tabs: Home, Quests, a raised button to log an action, Team and Me. Solar stays
// a route (opened from Me) without a tab of its own. A photo GEDA approved since last time is
// celebrated here, whichever tab is open.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform, Pressable, StyleSheet, View } from "react-native";

import { Celebration } from "@/components/motion";
import { useI18n } from "@/i18n";
import { registerForAlerts } from "@/lib/push";
import { flushQueue } from "@/lib/queue";
import { useVerifiedCelebration } from "@/lib/verified";
import { fonts, shadow, useColors } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

const ICONS: Record<string, [IconName, IconName]> = {
  index: ["home", "home-outline"],
  quests: ["trophy", "trophy-outline"],
  community: ["people", "people-outline"],
  me: ["person-circle", "person-circle-outline"],
};

export default function TabsLayout() {
  const { t } = useI18n();
  const c = useColors();
  useSendQueuedLogs();
  const [verified, closeVerified] = useVerifiedCelebration();
  useEffect(() => {
    void registerForAlerts();
  }, []);
  return (
    <>
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: Platform.OS === "web" ? 68 : undefined,
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
      <Tabs.Screen name="quests" options={{ title: t("nav.quests") }} />
      <Tabs.Screen
        name="act"
        options={{
          title: t("nav.log"),
          tabBarLabel: () => null,
          tabBarButton: (props) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("nav.log")}
              accessibilityState={props.accessibilityState}
              onPress={props.onPress}
              style={styles.raisedSlot}
            >
              {({ pressed }) => (
                <View style={[styles.raised, shadow, { backgroundColor: c.primary, transform: [{ rotate: "-6deg" }, { scale: pressed ? 0.92 : 1 }] }]}>
                  <Ionicons name="add" size={30} color={c.onPrimary} />
                </View>
              )}
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="community" options={{ title: t("nav.team") }} />
      <Tabs.Screen name="me" options={{ title: t("tab.me") }} />
      <Tabs.Screen name="solar" options={{ href: null, title: t("nav.solar") }} />
    </Tabs>
    <Celebration info={verified} onClose={closeVerified} closeLabel={t("celebrate.close")} />
    </>
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

const styles = StyleSheet.create({
  raisedSlot: { flex: 1, alignItems: "center", justifyContent: "flex-start" },
  raised: { width: 56, height: 56, borderRadius: 20, marginTop: -18, alignItems: "center", justifyContent: "center" },
});
