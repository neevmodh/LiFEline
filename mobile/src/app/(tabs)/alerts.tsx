// Alerts: what to do right now (contextual nudges from the time of day, the weather, the grid peak and
// your own home, GET /api/nudges) and updates meant for you (photo approved or not, messages from your
// society, GET /api/notifications). Works without push, so nothing depends on notification permission.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Celebration } from "@/components/celebration";
import { Columns, usePageWidth } from "@/components/layout";
import { Rise } from "@/components/motion";
import { ErrorText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, type Nudge } from "@/lib/api";
import { useLogAction } from "@/lib/log-action";
import { fonts, shadow, space, type, useColors } from "@/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const CATEGORY_ICON: Record<Nudge["category"], IconName> = {
  peak_shift: "flash-outline",
  efficiency: "bulb-outline",
  mobility: "bus-outline",
  progress: "trending-down-outline",
};

export default function Alerts() {
  const { t, locale } = useI18n();
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const page = usePageWidth();
  const qc = useQueryClient();
  const nudges = useQuery({ queryKey: ["nudges"], queryFn: api.nudges });
  const notes = useQuery({ queryKey: ["notifications"], queryFn: api.notifications });
  const logger = useLogAction();
  const markRead = useMutation({
    mutationFn: api.markNotificationsRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = notes.data?.unread ?? 0;
  // Opening the inbox reads it (once per visit, even if that fails); the dots stay until the next visit.
  const marked = useRef(false);
  const { mutate: markAll } = markRead;
  useEffect(() => {
    if (unread > 0 && !marked.current) {
      marked.current = true;
      markAll();
    }
  }, [unread, markAll]);

  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale === "en" ? "en-IN" : `${locale}-IN`, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const tones: Record<Nudge["category"], [string, string]> = {
    peak_shift: [c.saffronSoft, c.saffronInk],
    efficiency: [c.greenSoft, c.greenDeep],
    mobility: [c.skySoft, c.sky],
    progress: [c.claySoft, c.clay],
  };

  const now = (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Text style={[styles.section, { color: c.text }]}>{t("alerts.now")}</Text>
        {nudges.data?.temperature_c != null && <Text style={[type.small, { color: c.muted }]}>{`${Math.round(nudges.data.temperature_c)}°C`}</Text>}
      </View>
      {nudges.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}
      {logger.error && <ErrorText>{logger.error}</ErrorText>}
      {nudges.data && nudges.data.nudges.length === 0 && <Text style={[type.small, { color: c.muted }]}>{t("alerts.nowNone")}</Text>}
      {nudges.data?.nudges.map((n, i) => {
        const [bg, ink] = tones[n.category] ?? tones.efficiency;
        return (
          <Rise key={n.code} index={i} style={[styles.item, shadow, { backgroundColor: c.surface }]}>
            <View style={[styles.icon, { backgroundColor: bg }]}>
              <Ionicons name={CATEGORY_ICON[n.category] ?? "bulb-outline"} size={22} color={ink} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[styles.title, { color: c.text }]}>{n.title}</Text>
              <Text style={[type.small, { color: c.muted }]}>{n.body}</Text>
              {n.action_code && (
                <Pressable
                  accessibilityRole="button"
                  disabled={logger.busy}
                  onPress={() => logger.logNow({ code: n.action_code as string, title: n.title, fullPoints: 0 })}
                  style={({ pressed }) => [styles.logBtn, { backgroundColor: c.primary, opacity: logger.busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                >
                  <Ionicons name="checkmark" size={16} color={c.onPrimary} />
                  <Text style={[styles.logText, { color: c.onPrimary }]}>{t("alerts.logIt")}</Text>
                </Pressable>
              )}
            </View>
          </Rise>
        );
      })}
    </View>
  );

  const updates = (
    <View style={{ gap: space.sm }}>
      <Text style={[styles.section, { color: c.text }]}>{t("alerts.updates")}</Text>
      {notes.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}
      {notes.data && notes.data.items.length === 0 && (
        <View style={[styles.empty, { borderColor: c.border }]}>
          <Ionicons name="notifications-outline" size={26} color={c.muted} />
          <Text style={[type.small, { color: c.muted, textAlign: "center" }]}>{t("alerts.none")}</Text>
        </View>
      )}
      {notes.data?.items.map((n, i) => (
        <Rise key={n.id} index={i} style={[styles.item, { backgroundColor: n.read ? c.surface : c.greenSoft }]}>
          <View style={[styles.dot, { backgroundColor: n.read ? "transparent" : c.saffron }]} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.title, { color: c.text }]}>{n.title}</Text>
            <Text style={[type.small, { color: c.muted }]}>{n.body}</Text>
            <Text style={[styles.time, { color: c.muted }]}>{when(n.created_at)}</Text>
          </View>
        </Rise>
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={[styles.page, page, { paddingTop: insets.top + space.md }]}
        refreshControl={<RefreshControl refreshing={nudges.isRefetching || notes.isRefetching} onRefresh={() => [nudges, notes].forEach((q) => void q.refetch())} />}
      >
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.back")}
            onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))}
            style={[styles.back, { borderColor: c.border, backgroundColor: c.surface }]}
          >
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
          <Text style={[type.title, { color: c.text, fontSize: 24, flex: 1 }]}>{t("alerts.title")}</Text>
        </View>
        <Columns left={now} right={updates} ratio={1} />
      </ScrollView>
      <Celebration info={logger.celebration} onClose={logger.closeCelebration} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2, gap: space.md },
  top: { flexDirection: "row", alignItems: "center", gap: space.md, marginBottom: space.xs },
  back: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  section: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25 },
  item: { flexDirection: "row", gap: space.md, padding: space.md, borderRadius: 18, alignItems: "flex-start" },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.bodyBold, fontSize: 15, lineHeight: 20 },
  logBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 12, minHeight: 36, borderRadius: 12, marginTop: 4 },
  logText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  time: { fontFamily: fonts.bodyMedium, fontSize: 11 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 18, padding: space.lg, alignItems: "center", gap: space.sm },
});
