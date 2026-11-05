import { lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { SectionTab } from "@/components/section-tabs";
import { SectionLayout } from "@/components/section-layout";
import { useAuth } from "@/features/auth/auth-context";
import { likedQueries } from "@/features/liked/queries";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Playlists = lazy(() => import("@/pages/Playlists"));
const LikedSongs = lazy(() => import("@/pages/LikedSongs"));

export function HomeSection() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { data: likedIds = [] } = useQuery(likedQueries.ids(profile?.id ?? ""));

  const tabs: SectionTab[] = [
    {
      id: "listen",
      labelKey: "home.tabs.listen",
      content: <Dashboard />,
    },
    {
      id: "playlists",
      labelKey: "home.tabs.playlists",
      content: <Playlists />,
    },
    {
      id: "liked",
      labelKey: "home.tabs.liked",
      badge: likedIds.length,
      content: <LikedSongs />,
    },
  ];

  return <SectionLayout title={t("home.title")} basePath="/home" tabs={tabs} />;
}
