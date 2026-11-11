import { View } from "react-native";

import { LanguagePicker } from "@/components/language-picker";
import { Body, Button, Screen, Title } from "@/components/ui";
import { useI18n } from "@/i18n";
import { useSession } from "@/lib/session";
import { space } from "@/theme";

export default function Me() {
  const { t } = useI18n();
  const { user, signOut } = useSession();
  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Title>{user?.name}</Title>
        <Body muted>{user?.email}</Body>
      </View>
      <LanguagePicker />
      <Body muted>{t("mobile.comingSoon")}</Body>
      <Button variant="plain" title={t("nav.signOut")} onPress={signOut} />
    </Screen>
  );
}
