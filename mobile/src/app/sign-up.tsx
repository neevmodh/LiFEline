import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Body, Button, ErrorText, Field, Hero } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { radius, space, type, useColors } from "@/theme";

export default function SignUp() {
  const { t } = useI18n();
  const { signUp } = useSession();
  const c = useColors();
  const districts = useQuery({ queryKey: ["districts"], queryFn: api.districts });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [ward, setWard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (districtId === null) {
      setError(t("auth.district"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password, district_id: districtId, ward: ward.trim() || undefined });
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} keyboardShouldPersistTaps="handled">
      <Hero eyebrow="Nidhi · Mission LiFE" title={t("auth.join")} subtitle={t("auth.registerSub")} />
      <View style={{ padding: space.lg, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <Field label={t("auth.name")} value={name} onChangeText={setName} autoComplete="name" />
        <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label={`${t("auth.password")} (${t("auth.passwordHint")})`} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />

        <View style={{ gap: space.sm }}>
          <Text style={[type.small, { color: c.muted }]}>{t("auth.district")}</Text>
          {districts.isPending && <Body muted>{t("auth.districtsLoading")}</Body>}
          {districts.isError && (
            <View style={{ gap: space.sm }}>
              <ErrorText>{t("auth.districtsFailed")}</ErrorText>
              <Button variant="plain" title={t("auth.districtsRetry")} onPress={() => districts.refetch()} />
            </View>
          )}
          <View style={styles.chips}>
            {districts.data?.map((d) => {
              const on = d.id === districtId;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => setDistrictId(d.id)}
                  style={[styles.chip, { borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : c.surface }]}
                >
                  <Text style={[type.small, { color: on ? c.onPrimary : c.text }]}>{d.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Field label={`${t("auth.ward")} (${t("common.optional")})`} value={ward} onChangeText={setWard} />

        {error && <ErrorText>{error}</ErrorText>}
        <Button title={t("auth.create")} onPress={submit} busy={busy} icon="leaf-outline" />
        <Body muted>
          {t("auth.alreadyJoined")}{" "}
          <Link href="/sign-in" style={{ color: c.primary, fontWeight: "600" }}>
            {t("nav.signIn")}
          </Link>
        </Body>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 40, justifyContent: "center" },
});
