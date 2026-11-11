// GEDA staff (admin, officer, reviewer, auditor) use the web console; the phone app is for households.
import * as WebBrowser from "expo-web-browser";

import { Body, Button, Screen, Title } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";

const CONSOLE_URL = process.env.EXPO_PUBLIC_CONSOLE_URL ?? "http://localhost:3000/geda";

export default function Staff() {
  const { t } = useI18n();
  const { signOut } = useSession();
  return (
    <Screen>
      <Title>{t("mobile.staffTitle")}</Title>
      <Body muted>{t("mobile.staffBody")}</Body>
      <Button title={t("mobile.openConsole")} onPress={() => WebBrowser.openBrowserAsync(CONSOLE_URL)} />
      <Button variant="plain" title={t("nav.signOut")} onPress={signOut} />
    </Screen>
  );
}
