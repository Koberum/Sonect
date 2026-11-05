import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ListPlus, MicVocal, Play } from "lucide-react";
import type { Artist } from "@repo/types/catalog";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { getTracksByArtist } from "@/features/catalog/api";
import { MediaActionMenu } from "./media-action-menu";
import { MediaCard } from "./media-card";

export interface ArtistCardProps {
  artist: Artist;
  className?: string;
}

export function ArtistCard({ artist, className }: ArtistCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { play, addToQueue } = usePlayTrack();
  const coverPreviews = artist.coverPreviews ?? [];

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
              onSelect: () => {
                void getTracksByArtist(String(artist.id)).then((tracks) => {
                  if (tracks[0]) void play(tracks[0]);
                });
              },
            },
            {
              key: "queue",
              label: t("contextMenu.addToQueue"),
              icon: ListPlus,
              onSelect: () => {
                void getTracksByArtist(String(artist.id)).then((tracks) => {
                  for (const track of tracks) void addToQueue(track.file);
                });
              },
            },
          ]}
        />
      }
    />
  );
}
