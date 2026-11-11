import { Body, Screen, Title } from "@/components/ui";
import { useI18n } from "@/i18n";

export default function Tab() {
  const { t } = useI18n();
  return (
    <Screen>
      <Title>{t("nav.solar")}</Title>
      <Body muted>{t("mobile.comingSoon")}</Body>
    </Screen>
  );
}
