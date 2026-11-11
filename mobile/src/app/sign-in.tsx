import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Body, Button, ErrorText, Field, Screen, Title } from "@/components/ui";
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
    <Screen>
      <LanguagePicker />
      <View style={{ gap: space.xs }}>
        <Title>{t("auth.welcomeBack")}</Title>
        <Body muted>{t("auth.loginSub")}</Body>
      </View>
      <Field label={t("auth.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label={t("auth.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title={t("nav.signIn")} onPress={submit} busy={busy} />
      <Body muted>
        {t("auth.newHere")}{" "}
        <Link href="/sign-up" style={{ color: c.primary, fontWeight: "600" }}>
          {t("auth.createLink")}
        </Link>
      </Body>
    </Screen>
  );
}
