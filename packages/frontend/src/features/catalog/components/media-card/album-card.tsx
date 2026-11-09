import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Disc3, ListPlus, Play } from "lucide-react";
import type { Album, Track } from "@repo/types/catalog";
import { getTracksByAlbum } from "@/features/catalog/api";
import { useCollectionActions } from "@/features/catalog/use-collection-actions";
import { MediaActionMenu } from "./media-action-menu";
import { MediaCard } from "./media-card";

export interface AlbumCardProps {
  album: Album;
  className?: string;
}

export function AlbumCard({ album, className }: AlbumCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cachedTracks, setCachedTracks] = useState<Track[] | null>(null);

  const getTracks = useCallback(async (): Promise<Track[]> => {
    if (cachedTracks) return cachedTracks;
    const tracks = await getTracksByAlbum(String(album.id));
    setCachedTracks(tracks);
    return tracks;
  }, [album.id, cachedTracks]);

  const { playFirst, enqueueAll } = useCollectionActions(getTracks);

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
