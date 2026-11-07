import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { SectionTab } from "@/components/section-tabs";
import { SectionLayout } from "@/components/section-layout";
import { useAuth } from "@/features/auth/auth-context";
import { likedQueries } from "@/features/liked/queries";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const LikedSongs = lazy(() => import("@/pages/LikedSongs"));

export function DiscoverSection() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { data: likedIds = [] } = useQuery(likedQueries.ids(profile?.id ?? ""));

  const tabs: SectionTab[] = [
    {
      id: "listen",
      labelKey: "discover.tabs.listen",
      content: <Dashboard />,
    },
    {
      id: "liked",
      labelKey: "discover.tabs.liked",
      badge: likedIds.length,
      content: <LikedSongs />,
    },
  ];

  return (
    <SectionLayout
      title={t("discover.title")}
      basePath="/discover"
      tabs={tabs}
    />
  );
}
