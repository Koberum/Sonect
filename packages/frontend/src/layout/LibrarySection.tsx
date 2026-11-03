import { useTranslation } from "react-i18next";
import type { SectionTab } from "@/components/section-tabs";
import { SectionLayout } from "@/components/section-layout";

const TABS: SectionTab[] = [
  { href: "/library/albums", labelKey: "library.tabs.albums" },
  { href: "/library/artists", labelKey: "library.tabs.artists" },
  { href: "/library/genres", labelKey: "library.tabs.genres" },
  { href: "/library/statistics", labelKey: "library.tabs.statistics" },
];

export function LibrarySection() {
  const { t } = useTranslation();

  return (
    <SectionLayout
      title={t("library.title")}
      description={t("library.description")}
      tabs={TABS}
    />
  );
}
