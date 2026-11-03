import { useTranslation } from "react-i18next";
import type { SectionTab } from "@/components/section-tabs";
import { SectionLayout } from "@/components/section-layout";

const TABS: SectionTab[] = [
  { href: "/settings/audio", labelKey: "settings.tabs.audio" },
  { href: "/settings/playback", labelKey: "settings.tabs.playback" },
  { href: "/settings/libraries", labelKey: "settings.tabs.libraries" },
  { href: "/settings/appearance", labelKey: "settings.tabs.appearance" },
  { href: "/settings/debug", labelKey: "settings.tabs.debug" },
];

export function Settings() {
  const { t } = useTranslation();

  return (
    <SectionLayout
      title={t("settings.title")}
      description={t("settings.description")}
      tabs={TABS}
    />
  );
}
