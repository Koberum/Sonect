import { lazy } from "react";
import { useTranslation } from "react-i18next";
import type { SectionTab } from "@/components/section-tabs";
import { SectionLayout } from "@/components/section-layout";

const Albums = lazy(() => import("@/pages/Albums"));
const Artists = lazy(() =>
  import("@/pages/Artists").then((m) => ({ default: m.Artists })),
);
const Genres = lazy(() => import("@/pages/Genres"));
const Statistics = lazy(() =>
  import("@/pages/Statistics").then((m) => ({ default: m.Statistics })),
);

export function LibrarySection() {
  const { t } = useTranslation();

  const tabs: SectionTab[] = [
    {
      id: "albums",
      labelKey: "library.tabs.albums",
      content: <Albums />,
    },
    {
      id: "artists",
      labelKey: "library.tabs.artists",
      content: <Artists />,
    },
    {
      id: "genres",
      labelKey: "library.tabs.genres",
      content: <Genres />,
    },
    {
      id: "statistics",
      labelKey: "library.tabs.statistics",
      content: <Statistics />,
    },
  ];

  return (
    <SectionLayout title={t("library.title")} basePath="/library" tabs={tabs} />
  );
}
