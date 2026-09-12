import { cn, getCoverPath, hoverStyles } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import type { Album, Track } from "@repo/types/catalog";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { playSong, addToQueue } from "@/features/apis/mpdApis";
import { getTracksByAlbum } from "@/features/apis/catalogApis";
import { useState } from "react";

interface AlbumArtworkProps extends React.HTMLAttributes<HTMLDivElement> {
  album: Album;
  aspectRatio?: "portrait" | "square";
  width?: number;
  height?: number;
}

export function AlbumArtwork({
  album,
  aspectRatio = "portrait",
  width,
  height,
  className,
  ...props
}: AlbumArtworkProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cachedTracks, setCachedTracks] = useState<Track[] | null>(null);

  const getTracks = async (): Promise<Track[]> => {
    if (cachedTracks) return cachedTracks;
    const ts = await getTracksByAlbum(String(album.id));
    setCachedTracks(ts);
    return ts;
  };

  const handlePlayNext = async () => {
    const ts = await getTracks();
    if (ts.length > 0) playSong(ts[0]);
  };

  const handlePlayLater = async () => {
    const ts = await getTracks();
    for (const tr of ts) {
      addToQueue(tr.file);
    }
  };

  return (
    <div className={cn("cursor-pointer space-y-3", className)} {...props}>
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="mb-4 overflow-hidden rounded-md">
            <img
              src={getCoverPath(album.cover_path)}
              alt={album.title}
              width={width}
              height={height}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = "/default_cover.png";
              }}
              className={cn(
                "h-auto w-auto object-cover",
                hoverStyles,
                aspectRatio === "portrait" ? "aspect-3/4" : "aspect-square",
              )}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onClick={() => navigate(`/albums/${album.id}`)}>
            {t("album.goToAlbum")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handlePlayNext}>
            {t("contextMenu.playNext")}
          </ContextMenuItem>
          <ContextMenuItem onClick={handlePlayLater}>
            {t("contextMenu.playLater")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <div className="space-y-1 text-sm">
        <h3 className="leading-none font-medium">{album.title}</h3>
        <p className="text-muted-foreground text-xs">{album.artist_name}</p>
      </div>
    </div>
  );
}
