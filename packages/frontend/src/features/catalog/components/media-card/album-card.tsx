import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Disc3, ListPlus, Play } from "lucide-react";
import type { Album, Track } from "@repo/types/catalog";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { getTracksByAlbum } from "@/features/catalog/api";
import { MediaActionMenu } from "./media-action-menu";
import { MediaCard } from "./media-card";

export interface AlbumCardProps {
  album: Album;
  className?: string;
}

export function AlbumCard({ album, className }: AlbumCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { play, addToQueue } = usePlayTrack();
  const [cachedTracks, setCachedTracks] = useState<Track[] | null>(null);

  const getTracks = async (): Promise<Track[]> => {
    if (cachedTracks) return cachedTracks;
    const tracks = await getTracksByAlbum(String(album.id));
    setCachedTracks(tracks);
    return tracks;
  };

  const openAlbum = () => {
    void navigate(`/library/albums/${album.id}`);
  };

  return (
    <MediaCard
      className={className}
      artwork={{ kind: "single", src: album.cover_path, alt: album.title }}
      title={album.title}
      subtitle={album.artist_name}
      meta={album.year ? String(album.year) : undefined}
      onActivate={openAlbum}
      actions={
        <MediaActionMenu
          actions={[
            {
              key: "open",
              label: t("album.goToAlbum"),
              icon: Disc3,
              onSelect: openAlbum,
            },
            {
              key: "play",
              label: t("contextMenu.play"),
              icon: Play,
              separatorBefore: true,
              onSelect: () => {
                void getTracks().then((tracks) => {
                  if (tracks[0]) void play(tracks[0]);
                });
              },
            },
            {
              key: "queue",
              label: t("contextMenu.addToQueue"),
              icon: ListPlus,
              onSelect: () => {
                void getTracks().then((tracks) => {
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
