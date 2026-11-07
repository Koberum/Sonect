import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ListMusic, Play } from "lucide-react";
import type { PlaylistSummary } from "@repo/types/catalog";
import { playlistMutations } from "@/features/playlists/queries";
import { MediaActionMenu } from "./media-action-menu";
import { MediaCard } from "./media-card";

export interface PlaylistCardProps {
  playlist: PlaylistSummary;
  className?: string;
}

export function PlaylistCard({ playlist, className }: PlaylistCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loadMut = useMutation(playlistMutations.load());
  const coverPreviews = playlist.coverPreviews;
  const trackCount = playlist.trackCount;

  const openPlaylist = () => {
    void navigate(`/playlists/${playlist.id}`);
  };

  return (
    <MediaCard
      className={className}
      artwork={
        coverPreviews.length > 0
          ? {
              kind: "collage",
              images: coverPreviews,
              alt: playlist.name,
            }
          : { kind: "single", alt: playlist.name }
      }
      title={playlist.name}
      subtitle={t("playlist.trackCount", { count: trackCount })}
      onActivate={openPlaylist}
      actions={
        <MediaActionMenu
          actions={[
            {
              key: "open",
              label: t("playlist.open"),
              icon: ListMusic,
              onSelect: openPlaylist,
            },
            {
              key: "play",
              label: t("contextMenu.play"),
              icon: Play,
              separatorBefore: true,
              onSelect: () => {
                void loadMut.mutateAsync(playlist.id);
              },
            },
          ]}
        />
      }
    />
  );
}
