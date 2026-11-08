import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ListPlus, MicVocal, Play } from "lucide-react";
import type { Artist } from "@repo/types/catalog";
import { getTracksByArtist } from "@/features/catalog/api";
import { useCollectionActions } from "@/features/catalog/use-collection-actions";
import { MediaActionMenu } from "./media-action-menu";
import { MediaCard } from "./media-card";

export interface ArtistCardProps {
  artist: Artist;
  className?: string;
}

export function ArtistCard({ artist, className }: ArtistCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const coverPreviews = artist.coverPreviews ?? [];

  const loadTracks = useCallback(
    () => getTracksByArtist(String(artist.id)),
    [artist.id],
  );
  const { playFirst, enqueueAll } = useCollectionActions(loadTracks);

  const openArtist = () => {
    void navigate(`/library/artists/${artist.id}`);
  };

  return (
    <MediaCard
      className={className}
      artwork={
        coverPreviews.length > 0
          ? {
              kind: "collage",
              images: coverPreviews,
              alt: artist.name,
            }
          : { kind: "single", alt: artist.name }
      }
      title={artist.name}
      subtitle={t("artists.titleSingle")}
      onActivate={openArtist}
      actions={
        <MediaActionMenu
          actions={[
            {
              key: "open",
              label: t("artists.goToArtist"),
              icon: MicVocal,
              onSelect: openArtist,
            },
            {
              key: "play",
              label: t("contextMenu.play"),
              icon: Play,
              separatorBefore: true,
              onSelect: () => void playFirst(),
            },
            {
              key: "queue",
              label: t("contextMenu.addToQueue"),
              icon: ListPlus,
              onSelect: () => void enqueueAll(),
            },
          ]}
        />
      }
    />
  );
}
