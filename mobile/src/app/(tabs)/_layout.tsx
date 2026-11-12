// The household app's tabs: Home, Quests, a raised button to log an action, Team and Me (a sidebar on
// a wide browser window). Solar and Account are routes the bars show no button for. A photo GEDA
// approved since last time, and a prize just won, are celebrated here, whichever tab is open.
import { useQueryClient } from "@tanstack/react-query";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { AppState } from "react-native";

import { useWide } from "@/components/layout";
import { Celebration } from "@/components/celebration";
import { NidhiTabBar } from "@/components/tab-bar";
import { useI18n } from "@/i18n";
import { usePrizeCelebration } from "@/lib/prize-celebration";
import { registerForAlerts } from "@/lib/push";
import { flushQueue } from "@/lib/queue";
import { useVerifiedCelebration } from "@/lib/verified";

export default function TabsLayout() {
  const { t } = useI18n();
  const wide = useWide();
  useSendQueuedLogs();
  const [verified, closeVerified] = useVerifiedCelebration();
  const [prize, closePrize] = usePrizeCelebration();
  useEffect(() => {
    void registerForAlerts();
  }, []);
  return (
    <>
      <Tabs
        tabBar={(props) => <NidhiTabBar {...props} wide={wide} />}
        screenOptions={{ headerShown: false, tabBarPosition: wide ? "left" : "bottom" }}
      >
        <Tabs.Screen name="index" options={{ title: t("nav.home") }} />
        <Tabs.Screen name="quests" options={{ title: t("nav.quests") }} />
        <Tabs.Screen name="act" options={{ title: t("nav.log") }} />
        <Tabs.Screen name="community" options={{ title: t("nav.team") }} />
        <Tabs.Screen name="me" options={{ title: t("tab.me") }} />
        <Tabs.Screen name="solar" options={{ title: t("nav.solar") }} />
        <Tabs.Screen name="account" options={{ title: t("me.account") }} />
      </Tabs>
      {/* One celebration at a time: a just-logged action first, then a GEDA approval, then a prize. */}
      <Celebration deferred info={verified} onClose={closeVerified} />
      <Celebration deferred info={verified ? null : prize} onClose={closePrize} />
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
