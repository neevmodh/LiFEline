// A GEDA Peak Hour Challenge: today's hour window, whether it's live, progress, and a one-tap log
// of a heavy load moved out of it (shift_heavy_load, the only action the event counts).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Body, Card, ErrorText } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, ApiError, type Campaign } from "@/lib/api";
import { radius, space, type, useColors } from "@/theme";

const hour = (h: number | null) => {
  const v = h ?? 0;
  return `${((v + 11) % 12) + 1} ${v < 12 || v === 24 ? "AM" : "PM"}`;
};

export function PeakEventCard({ event }: { event: Campaign }) {
  const { t } = useI18n();
  const c = useColors();
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const log = useMutation({
    mutationFn: () => api.logAction("shift_heavy_load"),
    onSuccess: (res) => {
      setMessage({ ok: true, text: t("actions.flashLogged", { points: res.points_awarded, title: res.action.title }) });
      qc.invalidateQueries();
    },
    onError: (e) => setMessage({ ok: false, text: e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown") }),
  });
  return (
    <Card tone="saffron">
      <View style={styles.head}>
        <Text style={[type.small, { color: c.saffron, fontWeight: "800" }]}>⚡ {t("peak.title")}</Text>
        {event.live && (
          <View style={[styles.badge, { backgroundColor: c.red }]}>
            <Text style={[type.small, { color: "#fff", fontWeight: "700" }]}>{t("peak.live")}</Text>
          </View>
        )}
      </View>
      <Text style={[type.heading, { color: c.text }]}>{event.title}</Text>
      <Text style={[type.body, { color: c.text, fontWeight: "700" }]}>{t("peak.window", { from: hour(event.start_hour), to: hour(event.end_hour) })}</Text>
      <Body muted>{t("peak.ask")}</Body>
      <Body>{t("peak.count", { progress: event.progress, people: event.participants })}</Body>
      <Pressable
        accessibilityRole="button"
        disabled={log.isPending}
        onPress={() => log.mutate()}
        style={[styles.btn, { backgroundColor: c.saffron, opacity: log.isPending ? 0.6 : 1 }]}
      >
        <Text style={[type.small, { color: "#fff", fontWeight: "700" }]}>{t("peak.log")}</Text>
      </Pressable>
      {message && (message.ok ? <Body>{message.text}</Body> : <ErrorText>{message.text}</ErrorText>)}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderRadius: radius.lg, paddingHorizontal: space.sm, paddingVertical: 2 },
  btn: { borderRadius: radius.lg, minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: space.lg },
});
