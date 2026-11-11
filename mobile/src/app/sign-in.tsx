import { Link } from "expo-router";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Body, Button, ErrorText, Field, Hero, Icon } from "@/components/ui";
import { Sprout } from "@/components/illustrations";
import { LanguagePicker } from "@/components/language-picker";
import { useI18n } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { space, useColors } from "@/theme";

export default function SignIn() {
  const { t } = useI18n();
  const { signIn } = useSession();
  const c = useColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 0 ? e.message : t("mobile.serverDown"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} keyboardShouldPersistTaps="handled">
      <Hero eyebrow="Nidhi · Mission LiFE" title={t("auth.welcomeBack")} subtitle={t("auth.loginSub")}>
        <Sprout />
        <View style={{ gap: space.sm, marginTop: space.md }}>
          {(["signin.point1", "signin.point2", "signin.point3"] as const).map((k, i) => (
            <View key={k} style={{ flexDirection: "row", gap: space.sm, alignItems: "center" }}>
              <Icon name={(["flash-outline", "language-outline", "shield-checkmark-outline"] as const)[i]} size={18} color={c.saffron} />
              <Body>
                <Text style={{ color: c.text }}>{t(k)}</Text>
              </Body>
            </View>
          ))}
        </View>
      </Hero>
      <View style={{ padding: space.lg, gap: space.lg, width: "100%", maxWidth: 560, alignSelf: "center" }}>
      <LanguagePicker />
      <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title={t("nav.signIn")} onPress={submit} busy={busy} icon="log-in-outline" />
      <Body muted>
        {t("auth.newHere")}{" "}
        <Link href="/sign-up" style={{ color: c.primary, fontWeight: "600" }}>
          {t("auth.createLink")}
        </Link>
      </Body>
      </View>
    </ScrollView>
  );
}
