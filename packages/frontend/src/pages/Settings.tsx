import { lazy } from "react";
import { useTranslation } from "react-i18next";
import type { SectionTab } from "@/components/section-tabs";
import { SectionLayout } from "@/components/section-layout";

const AudioTab = lazy(() =>
  import("@/features/settings/audio-tab").then((m) => ({
    default: m.AudioTab,
  })),
);
const PlaybackTab = lazy(() =>
  import("@/features/settings/playback-tab").then((m) => ({
    default: m.PlaybackTab,
  })),
);
const LibrariesTab = lazy(() =>
  import("@/features/settings/libraries-tab").then((m) => ({
    default: m.LibrariesTab,
  })),
);
const AppearanceTab = lazy(() =>
  import("@/features/settings/appearance-tab").then((m) => ({
    default: m.AppearanceTab,
  })),
);
const DebugTab = lazy(() =>
  import("@/features/settings/debug-tab").then((m) => ({
    default: m.DebugTab,
  })),
);

export default function Settings() {
  const { t } = useTranslation();

  const tabs: SectionTab[] = [
    {
      id: "audio",
      labelKey: "settings.tabs.audio",
      content: <AudioTab />,
    },
    {
      id: "playback",
      labelKey: "settings.tabs.playback",
      content: <PlaybackTab />,
    },
    {
      id: "libraries",
      labelKey: "settings.tabs.libraries",
      content: <LibrariesTab />,
    },
    {
      id: "appearance",
      labelKey: "settings.tabs.appearance",
      content: <AppearanceTab />,
    },
    {
      id: "debug",
      labelKey: "settings.tabs.debug",
      content: <DebugTab />,
    },
  ];

  return (
    <SectionLayout
      title={t("settings.title")}
      basePath="/settings"
      tabs={tabs}
    />
  );
}
