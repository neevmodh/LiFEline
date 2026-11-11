// Me: your record and your data. The Impact Ledger keeps what the plan estimates, what you reported,
// what's awaiting review and what GEDA verified apart, by Mission LiFE theme; then level, badges,
// language, a download of everything Nidhi stores about you, and deleting your account and photos.
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import { BadgeList } from "@/components/badges";
import { Journey, LedgerColumns } from "@/components/journey";
import { Rise } from "@/components/motion";
import { LanguagePicker } from "@/components/language-picker";
import { Body, Button, Card, Choice, ErrorText, Field, Title, Hero } from "@/components/ui";
import { useI18n, type MessageKey } from "@/i18n";
import { api, ApiError, type Ledger } from "@/lib/api";
import { inr } from "@/lib/format";
import { saveTextFile } from "@/lib/save-file";
import { useSession } from "@/lib/session";
import { radius, space, type, useColors } from "@/theme";

const STATUSES = ["estimated", "self_reported", "pending", "verified"] as const;
type Status = (typeof STATUSES)[number];

export default function Me() {
  const { t } = useI18n();
  const c = useColors();
  const router = useRouter();
  const { user, signOut } = useSession();
  const [period, setPeriod] = useState<"month" | "all">("month");
  const ledger = useQuery({ queryKey: ["ledger", period], queryFn: () => api.ledger(period) });
  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });
  const badges = useQuery({ queryKey: ["badges"], queryFn: api.badges });
  const level = dashboard.data?.level;

  return (
    <ScrollView
        style={{ flex: 1, backgroundColor: c.background }}
        contentContainerStyle={{ paddingBottom: space.xxl }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={ledger.isRefetching} onRefresh={() => void ledger.refetch()} />}
      >
        <Hero eyebrow={level ? t("act.level", { level: level.level, title: level.title }) : undefined} title={user?.name ?? ""} subtitle={level ? `${user?.email} · ${t("act.points", { points: level.points })}` : user?.email} />
        <View style={styles.page}>

        {level && (
          <Rise index={0} style={[styles.panel, { backgroundColor: c.surface }]}>
            <Text style={[type.heading, { color: c.text }]}>{t("me.journey")}</Text>
            <Journey level={level.level} />
          </Rise>
        )}

        <Rise index={1} style={[styles.panel, { backgroundColor: c.surface }]}>
          <Text style={[type.heading, { color: c.text }]}>{t("me.ledger")}</Text>
          <Text style={[type.small, { color: c.muted }]}>{t("me.ledgerNote")}</Text>
          <Choice label="" value={period} onChange={setPeriod} options={[{ value: "month", label: t("me.month") }, { value: "all", label: t("me.all") }]} />
          {ledger.isError && <ErrorText>{t("home.loadFailed")}</ErrorText>}
          {ledger.data && <LedgerColumns ledger={ledger.data} />}
        </Rise>
        {ledger.data && <LedgerView ledger={ledger.data} />}

        <Pressable onPress={() => router.push("/solar")} accessibilityRole="link" style={({ pressed }) => [styles.linkRow, { backgroundColor: c.saffronSoft, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
            <Ionicons name="sunny-outline" size={22} color={c.saffronInk} />
            <Text style={[type.body, { color: c.saffronInk, flex: 1, fontWeight: "600" }]}>{t("nav.solar")}</Text>
            <Ionicons name="chevron-forward" size={20} color={c.saffronInk} />
          </Pressable>

        {badges.data && (
          <View style={{ gap: space.sm }}>
            <Text style={[type.heading, { color: c.text }]}>{t("act.badges")}</Text>
            <BadgeList badges={badges.data} />
          </View>
        )}

        <View style={{ gap: space.sm }}>
          <Text style={[type.heading, { color: c.text }]}>{t("you.language")}</Text>
          <LanguagePicker />
        </View>

        <YourData onDeleted={signOut} />
        <Button variant="plain" title={t("nav.signOut")} onPress={signOut} />
        </View>
      </ScrollView>
  );
}

function LedgerView({ ledger }: { ledger: Ledger }) {
  const { t } = useI18n();
  const c = useColors();
  const tone: Record<Status, string> = { estimated: c.muted, self_reported: c.sky, pending: c.saffron, verified: c.green };
  const themes = Object.entries(ledger.by_theme).filter(([, s]) => STATUSES.some((k) => s[k].actions > 0 || s[k].co2_kg > 0));
  return (
    <>
      <View style={styles.grid}>
        {STATUSES.map((k) => {
          const f = ledger.by_status[k];
          return (
            <View key={k} style={[styles.tile, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Text style={[type.small, { color: tone[k], fontWeight: "700" }]}>{t(`me.${k}` as MessageKey)}</Text>
              <Text style={[type.heading, { color: c.text, fontSize: 22 }]}>{`${Math.round(f.co2_kg * 10) / 10} kg CO₂`}</Text>
              <Text style={[type.small, { color: c.muted }]}>
                {`${Math.round(f.kwh)} kWh · ₹${inr(f.rs)}`}
                {k === "estimated" ? ` · ${t("me.estimatedHint")}` : ` · ${t("me.actions", { n: f.actions })}`}
              </Text>
            </View>
          );
        })}
      </View>
      {themes.length > 0 && (
        <Card>
          <Text style={type.heading}>{t("me.byTheme")}</Text>
          {themes.map(([theme, s]) => (
            <View key={theme} style={styles.themeRow}>
              <Text style={[type.body, { color: c.text, flex: 1 }]}>{t(`theme.${theme}` as MessageKey)}</Text>
              <Text style={[type.small, { color: c.muted, textAlign: "right" }]}>
                {STATUSES.filter((k) => s[k].co2_kg > 0 || s[k].actions > 0)
                  .map((k) => `${t(`me.${k}` as MessageKey)}: ${k === "estimated" ? `${Math.round(s[k].co2_kg * 10) / 10} kg` : t("me.actions", { n: s[k].actions })}`)
                  .join("\n")}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function YourData({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const fail = (e: unknown) => setNote({ ok: false, text: e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown") });

  const download = useMutation({
    mutationFn: async () => {
      const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
      await saveTextFile(`nidhi-my-data-${day}.json`, await api.exportData(), "application/json");
    },
    onSuccess: () => setNote({ ok: true, text: t("me.downloaded") }),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: () => api.deleteAccount(password),
    onSuccess: async () => {
      setNote({ ok: true, text: t("me.deleted") });
      await onDeleted(); // the account is gone, so the token is too
    },
    onError: fail,
  });

  return (
    <Card>
      <Text style={type.heading}>{t("you.data")}</Text>
      <Body muted>{t("you.dataBody")}</Body>
      <Button title={t("you.download")} busy={download.isPending} onPress={() => download.mutate()} />
      {!confirming ? (
        <Button variant="plain" title={t("you.delete")} onPress={() => setConfirming(true)} />
      ) : (
        <>
          <Body>{t("you.deleteConfirm")}</Body>
          <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
          <Button title={t("you.deleteGo")} busy={remove.isPending} onPress={() => password && remove.mutate()} />
          <Button variant="plain" title={t("common.cancel")} onPress={() => setConfirming(false)} />
        </>
      )}
      {note && (note.ok ? <Body>{note.text}</Body> : <ErrorText>{note.text}</ErrorText>)}
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" },
  panel: { borderRadius: 22, padding: space.lg, gap: space.md },
  linkRow: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, borderRadius: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  themeRow: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
});
