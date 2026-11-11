// Home: how am I doing (LiFE Score), how do I compare (homes like yours), what should I do today
// (the Action Engine's top 3, one tap to log), plus the streak, the Nidhi tree and Green Hours.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { NidhiTree } from "@/components/nidhi-tree";
import { BigNumber, Body, Card, ErrorText, Title } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, ApiError, type EngineToday } from "@/lib/api";
import { useSession } from "@/lib/session";
import { radius, space, type, useColors } from "@/theme";

const hour = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "AM" : "PM"}`;

export default function Home() {
  const { t } = useI18n();
  const c = useColors();
  const { user } = useSession();
  const qc = useQueryClient();

  const score = useQuery({ queryKey: ["score"], queryFn: api.score });
  const engine = useQuery({ queryKey: ["engine"], queryFn: api.engineToday });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const ledger = useQuery({ queryKey: ["ledger", "all"], queryFn: () => api.ledger("all") });
  const green = useQuery({ queryKey: ["green-hours"], queryFn: api.greenHours });
  const all = [score, engine, dashboard, ledger, green];
  const refreshing = all.some((q) => q.isRefetching);

  const firstName = user?.name.split(" ")[0] ?? "";
  const s = score.data;
  const verifiedKg = ledger.data?.by_status.verified.co2_kg ?? 0;
  const streak = dashboard.data?.streak_days ?? 0;
  const g = green.data;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => all.forEach((q) => q.refetch())} />}
      >
        <Title>{t("home.hello", { name: firstName })}</Title>

        <Card>
          <Body muted>{t("home.score")}</Body>
          {s ? (
            <>
              <View style={styles.row}>
                <BigNumber color={c.primary}>{s.score}</BigNumber>
                <Body muted>{t("home.of100")}</Body>
              </View>
              <ScoreBar efficiency={s.efficiency} consistency={s.consistency} verified={s.verified} />
              <Text style={[type.small, { color: c.muted }]}>
                {t("home.scoreParts", { e: Math.round(s.efficiency), c: Math.round(s.consistency), v: Math.round(s.verified) })}
              </Text>
            </>
          ) : (
            <Placeholder failed={score.isError} />
          )}
        </Card>

        {s && (
          <Card tone="green">
            <Body muted>{t("home.peers")}</Body>
            <Body>{s.comparison.summary}</Body>
          </Card>
        )}

        <View style={{ gap: space.sm }}>
          <Text style={[type.heading, { color: c.text }]}>{t("home.today")}</Text>
          {engine.data ? (
            <TopActions data={engine.data} onLogged={() => qc.invalidateQueries()} />
          ) : (
            <Placeholder failed={engine.isError} />
          )}
        </View>

        {dashboard.data && (
          <Card tone="saffron">
            <Text style={[type.heading, { color: c.text }]}>
              {streak > 0 ? `🔥 ${t("home.streak", { days: streak })}` : t("home.streakNone")}
            </Text>
          </Card>
        )}

        <Card>
          <Text style={[type.heading, { color: c.text }]}>{t("home.tree")}</Text>
          {ledger.data ? (
            <View style={styles.treeRow}>
              <NidhiTree verifiedKg={verifiedKg} />
              <View style={{ flex: 1 }}>
                <Body muted>{verifiedKg > 0 ? t("home.treeGrows", { kg: Math.round(verifiedKg * 10) / 10 }) : t("home.treeSeed")}</Body>
              </View>
            </View>
          ) : (
            <Placeholder failed={ledger.isError} />
          )}
        </Card>

        <Card tone="green">
          <Text style={[type.heading, { color: c.text }]}>☀️ {t("home.green")}</Text>
          {g ? (
            <Body>
              {g.today
                ? t("home.greenToday", { from: hour(g.today.start_hour), to: hour(g.today.end_hour) })
                : g.tomorrow
                  ? t("home.greenTomorrow", { from: hour(g.tomorrow.start_hour), to: hour(g.tomorrow.end_hour) })
                  : t("home.greenNone")}
            </Body>
          ) : (
            <Placeholder failed={green.isError} />
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function ScoreBar({ efficiency, consistency, verified }: { efficiency: number; consistency: number; verified: number }) {
  const c = useColors();
  return (
    <View style={[styles.bar, { backgroundColor: c.border }]}>
      <View style={{ flex: efficiency, backgroundColor: c.navySoft }} />
      <View style={{ flex: consistency, backgroundColor: c.green }} />
      <View style={{ flex: verified, backgroundColor: c.saffron }} />
      <View style={{ flex: Math.max(0, 100 - efficiency - consistency - verified) }} />
    </View>
  );
}

function TopActions({ data, onLogged }: { data: EngineToday; onLogged: () => void }) {
  const { t } = useI18n();
  const c = useColors();
  const [failed, setFailed] = useState<string | null>(null);
  const [logged, setLogged] = useState<string | null>(null);
  // A logged action leaves today's list (the engine only ranks what's still to do), so say it worked.
  const log = useMutation({
    mutationFn: (code: string) => api.logAction(code),
    onSuccess: (_, code) => {
      setFailed(null);
      setLogged(data.cards.find((card) => card.code === code)?.title ?? null);
      onLogged();
    },
    onError: (e, code) => setFailed(e instanceof ApiError && e.status !== 0 ? `${code}:${e.message}` : `${code}:`),
  });

  return (
    <>
      {logged && (
        <Card tone="green">
          <Text style={[type.body, { color: c.green, fontWeight: "700" }]}>{t("home.logged", { title: logged })}</Text>
        </Card>
      )}
      {data.cards.filter((card) => card.top).map((card) => {
        const error = failed?.startsWith(`${card.code}:`) ? failed.slice(card.code.length + 1) || t("home.logFailed") : null;
        return (
          <Card key={card.code}>
            <View style={styles.cardHead}>
              <Text style={[type.heading, { color: c.text, flex: 1 }]}>{card.title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t("home.done")}: ${card.title}`}
                disabled={log.isPending}
                onPress={() => log.mutate(card.code)}
                style={[styles.doneBtn, { backgroundColor: c.green, opacity: log.isPending ? 0.6 : 1 }]}
              >
                <Text style={[type.small, { color: "#fff", fontWeight: "700" }]}>{t("home.done")}</Text>
              </Pressable>
            </View>
            {card.reasons.slice(0, 2).map((r) => (
              <Body key={r} muted>
                {r}
              </Body>
            ))}
            <Text style={[type.small, { color: c.green, fontWeight: "600" }]}>{t("home.pointsOnly", { points: card.points })}</Text>
            {error && <ErrorText>{error}</ErrorText>}
          </Card>
        );
      })}
    </>
  );
}

function Placeholder({ failed }: { failed: boolean }) {
  const { t } = useI18n();
  return failed ? <ErrorText>{t("home.loadFailed")}</ErrorText> : <Body muted>…</Body>;
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  bar: { flexDirection: "row", height: 10, borderRadius: radius.sm, overflow: "hidden" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  doneBtn: { borderRadius: radius.lg, paddingHorizontal: space.lg, minHeight: 40, justifyContent: "center" },
  treeRow: { flexDirection: "row", alignItems: "center", gap: space.lg },
});
