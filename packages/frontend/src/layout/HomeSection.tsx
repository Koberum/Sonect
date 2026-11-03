import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { SectionTab } from "@/components/section-tabs";
import { SectionLayout } from "@/components/section-layout";
import { useAuth } from "@/features/auth/auth-context";
import { likedQueries } from "@/features/liked/queries";

export function HomeSection() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { data: likedIds = [] } = useQuery(likedQueries.ids(profile?.id ?? ""));

  const tabs: SectionTab[] = [
    { href: "/home/listen", labelKey: "home.tabs.listen" },
    { href: "/home/playlists", labelKey: "home.tabs.playlists" },
    {
      href: "/home/liked",
      labelKey: "home.tabs.liked",
      badge: likedIds.length,
    },
  ];

  return <SectionLayout title={t("home.title")} tabs={tabs} />;
}
