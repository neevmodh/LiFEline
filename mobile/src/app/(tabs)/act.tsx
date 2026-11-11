// Act: every action the engine ranks for this home, by Mission LiFE theme, with what it saves, its
// points and the proof rule. Log now for 40% of the points, or add a photo for all of them after
// review. The daily challenge pays 2x. Logs made offline wait on the phone (lib/queue.ts).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Body, Card, Choice, ErrorText, Title } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { api, ApiError, type ActionLog, type Photo } from "@/lib/api";
import { enqueue } from "@/lib/queue";
import { radius, space, type, useColors } from "@/theme";

const THEMES = ["energy", "water", "plastic", "food", "waste", "ewaste", "health"] as const;
const SELF_REPORT_SHARE = 0.4; // backend services/gamification.py

type Flash = { tone: "ok" | "error"; text: string } | null;

export default function Act() {
  const { t } = useI18n();
  const c = useColors();
  const qc = useQueryClient();
  const engine = useQuery({ queryKey: ["engine"], queryFn: api.engineToday });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const challenge = useQuery({ queryKey: ["challenge"], queryFn: api.dailyChallenge });
  const badges = useQuery({ queryKey: ["badges"], queryFn: api.badges });
  const [theme, setTheme] = useState<"all" | (typeof THEMES)[number]>("all");
  const [flash, setFlash] = useState<Flash>(null);
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  // The result shows above the list, so bring it into view wherever the card was.
  useEffect(() => {
    if (flash) scroller.current?.scrollTo({ y: 0, animated: true });
  }, [flash]);

  const log = useMutation({
    mutationFn: ({ code, proof }: { code: string; title: string; proof?: Photo }) => api.logAction(code, proof),
    onSuccess: (res: ActionLog, { title }) => {
      setFlash({
        tone: "ok",
        text: res.status === "pending"
          ? t("actions.flashPending", { title })
          : t("actions.flashLogged", { points: res.points_awarded, title }),
      });
      qc.invalidateQueries();
    },
    onError: async (e, { code, title, proof }) => {
      if (e instanceof ApiError && e.status === 0 && !proof) {
        await enqueue(code, title);
        setFlash({ tone: "ok", text: t("act.offlineQueued", { title }) });
        return;
      }
      // 409: this photo was already used; 429: daily limit; 422: not for this home. The server says which.
      setFlash({ tone: "error", text: e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown") });
    },
  });

  async function withPhoto(code: string, title: string) {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.7 };
    const res = perm.granted ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets[0]) log.mutate({ code, title, proof: res.assets[0] });
  }

  const level = dashboard.data?.level;
  const cards = (engine.data?.cards ?? []).filter((card) => theme === "all" || card.theme === theme);
  const ch = challenge.data;
  const refreshing = [engine, dashboard, challenge, badges].some((q) => q.isRefetching);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["top"]}>
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => qc.invalidateQueries()} />}
      >
        <Title>{t("actions.title")}</Title>

        {level && (
          <Card>
            <Text style={[type.number, { color: c.primary }]}>{t("act.points", { points: level.points })}</Text>
            <Body>{t("act.level", { level: level.level, title: level.title })}</Body>
            <View style={[styles.bar, { backgroundColor: c.border }]}>
              <View style={{ flex: level.points, backgroundColor: c.green }} />
              <View style={{ flex: Math.max(0, level.next_level_at - level.points) }} />
            </View>
            <Text style={[type.small, { color: c.muted }]}>{t("act.toNext", { n: Math.max(0, level.next_level_at - level.points) })}</Text>
          </Card>
        )}

        {ch && (
          <Card tone="saffron">
            <Text style={[type.small, { color: c.saffron, fontWeight: "700" }]}>{t("act.challenge")}</Text>
            <Text style={[type.heading, { color: c.text }]}>{ch.action.title}</Text>
            {ch.completed ? (
              <Body>{t("act.challengeDone")}</Body>
            ) : (
              <LogButtons
                busy={log.isPending}
                onNow={() => log.mutate({ code: ch.action.code, title: ch.action.title })}
                onPhoto={() => withPhoto(ch.action.code, ch.action.title)}
              />
            )}
          </Card>
        )}

        {flash && (
          <Card tone={flash.tone === "ok" ? "green" : "plain"}>
            {flash.tone === "ok" ? <Body>{flash.text}</Body> : <ErrorText>{flash.text}</ErrorText>}
          </Card>
        )}

        <Choice
          label={t("common.choose")}
          value={theme}
          onChange={setTheme}
          options={[{ value: "all" as const, label: t("actions.all") }, ...THEMES.map((th) => ({ value: th, label: t(`theme.${th}` as MessageKey) }))]}
        />

        {engine.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}
        {engine.data && cards.length === 0 && <Body muted>{t("act.empty")}</Body>}
        {cards.map((card) => {
          const now = Math.round(card.points * SELF_REPORT_SHARE * (card.is_challenge ? 2 : 1));
          const full = card.points * (card.is_challenge ? 2 : 1);
          return (
            <Card key={card.code}>
              <Text style={[type.small, { color: c.muted }]}>{t(`theme.${card.theme}` as MessageKey)}</Text>
              <Text style={[type.heading, { color: c.text }]}>{card.title}</Text>
              {card.reasons.slice(0, 2).map((r) => (
                <Body key={r} muted>
                  {r}
                </Body>
              ))}
              <View style={styles.facts}>
                {card.rs >= 1 && <Fact text={`₹${Math.round(card.rs)}`} />}
                {card.impact_estimated && card.co2_kg > 0 && <Fact text={`${Math.round(card.co2_kg * 100) / 100} kg CO₂`} />}
                <Fact text={t("actions.perDay", { n: card.max_per_day })} />
              </View>
              <Text style={[type.small, { color: c.green, fontWeight: "600" }]}>{t("act.proofRule", { now, full })}</Text>
              <LogButtons
                busy={log.isPending}
                onNow={() => log.mutate({ code: card.code, title: card.title })}
                onPhoto={() => withPhoto(card.code, card.title)}
              />
            </Card>
          );
        })}

        {badges.data && (
          <View style={{ gap: space.sm }}>
            <Text style={[type.heading, { color: c.text }]}>{t("act.badges")}</Text>
            <View style={styles.badges}>
              {badges.data.map((b) => (
                <View key={b.code} style={[styles.badge, { borderColor: b.earned ? c.green : c.border, backgroundColor: b.earned ? c.greenSoft : c.surface }]}>
                  <Text style={[type.small, { color: c.text, fontWeight: "700" }]}>{b.earned ? "🏅 " : ""}{t(`badge.${b.code}` as MessageKey)}</Text>
                  {!b.earned && (
                    <Text style={[type.small, { color: c.muted }]}>
                      {t(`badge.${b.code}.how` as MessageKey, { n: b.target })} · {Math.round(b.progress * b.target)}/{b.target}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function LogButtons({ busy, onNow, onPhoto }: { busy: boolean; onNow: () => void; onPhoto: () => void }) {
  const { t } = useI18n();
  const c = useColors();
  return (
    <View style={styles.buttons}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onNow} style={[styles.btn, { backgroundColor: c.green, opacity: busy ? 0.6 : 1 }]}>
        <Text style={[type.small, { color: "#fff", fontWeight: "700" }]}>{t("act.logNow")}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onPhoto} style={[styles.btn, { borderWidth: 1, borderColor: c.green, opacity: busy ? 0.6 : 1 }]}>
        <Text style={[type.small, { color: c.green, fontWeight: "700" }]}>📷 {t("act.logPhoto")}</Text>
      </Pressable>
    </View>
  );
}

function Fact({ text }: { text: string }) {
  const c = useColors();
  return (
    <View style={[styles.fact, { backgroundColor: c.background }]}>
      <Text style={[type.small, { color: c.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" },
  bar: { flexDirection: "row", height: 8, borderRadius: radius.sm, overflow: "hidden" },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  fact: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  buttons: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  btn: { borderRadius: radius.lg, paddingHorizontal: space.lg, minHeight: 44, justifyContent: "center" },
  badges: { gap: space.sm },
  badge: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
});
