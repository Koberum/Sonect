import { cn, getCoverPath } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import type { Artist } from "@repo/types/library";
import { useTranslation } from "react-i18next";
import { getTracksByArtist } from "@/features/apis/libraryApis";
import { useNavigate } from "react-router-dom";
import { playSong, addToQueue } from "@/features/apis/mpdApis";
import { ImageCollage } from "./image-collage";

interface ArtistArtworkProps extends React.HTMLAttributes<HTMLDivElement> {
  artist: Artist;
  aspectRatio?: "portrait" | "square" | "round";
  width?: number;
  height?: number;
}

export function ArtistArtwork({
  artist,
  aspectRatio = "portrait",
  width,
  height,
  className,
  ...props
}: ArtistArtworkProps) {
  const navigate = useNavigate();

  const { t } = useTranslation();

  const coverPreviews = artist.coverPreviews ?? [];

  const handlePlayNext = async () => {
    const tracks = await getTracksByArtist(String(artist.id));
    if (tracks.length > 0) playSong(tracks[0]);
  };

  const handlePlayLater = async () => {
    const tracks = await getTracksByArtist(String(artist.id));
    for (const tr of tracks) {
      addToQueue(tr.file);
    }
  };

  if (coverPreviews.length === 0) {
    return (
      <div
        className={cn(
          "bg-muted flex h-full items-center justify-center rounded-md",
          className,
        )}
        style={{ width, height }}
        {...props}
      >
        <span className="text-muted-foreground text-sm">
          {t("artists.noAlbums")}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("cursor-pointer space-y-3", className)} {...props}>
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="group mb-4 overflow-hidden rounded-md">
            <ImageCollage
              aspectRatio={aspectRatio === "round" ? "square" : aspectRatio}
              images={coverPreviews.map((p) => getCoverPath(p))}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem
            onClick={() => navigate(`/artists/${artist.id}/albums`)}
          >
            {t("artists.titleSingle")}
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
        <h3 className="leading-none font-medium">{artist.name}</h3>
        <p className="text-muted-foreground text-xs">
          {t("artists.titleSingle")}
        </p>
      </div>
    </div>
  );
}
