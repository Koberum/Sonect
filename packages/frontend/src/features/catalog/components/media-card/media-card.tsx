import type { ReactNode, DragEvent } from "react";
import { cn, getCoverPath } from "@/lib/utils";
import { LikeButton } from "@/features/liked/components/like-button";
import { ImageCollage } from "./image-collage";

export type MediaArtwork =
  | { kind: "single"; src?: string; alt: string }
  | { kind: "collage"; images: string[]; alt: string };

export interface MediaCardProps {
  artwork: MediaArtwork;
  title: string;
  subtitle?: string;
  meta?: string;
  onActivate?: () => void;
  activateLabel?: string;
  likeTrackId?: number;
  actions?: ReactNode;
  isPlaying?: boolean;
  className?: string;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}

/**
 * The single visual representation for albums, artists, playlists and tracks
 * in grids and carousels. Tables keep using their own compact rows.
 */
export function MediaCard({
  artwork,
  title,
  subtitle,
  meta,
  onActivate,
  activateLabel,
  likeTrackId,
  actions,
  isPlaying = false,
  className,
  draggable,
  onDragStart,
  onDragEnd,
}: MediaCardProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "group bg-card hover:bg-muted/60 relative flex flex-col gap-3 rounded-lg p-3 shadow-sm transition-colors",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onActivate?.()}
        aria-label={activateLabel ?? title}
        className="focus-visible:ring-ring absolute inset-0 z-0 cursor-pointer rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      />
      <div className="pointer-events-none relative z-10 flex flex-col gap-3">
        <div className="relative">
          <div className="bg-muted aspect-square w-full overflow-hidden rounded-md">
            {artwork.kind === "collage" ? (
              <ImageCollage
                images={artwork.images.map((image) => getCoverPath(image))}
                aspectRatio="square"
              />
            ) : (
              <img
                src={getCoverPath(artwork.src)}
                alt={artwork.alt}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                onError={(event) => {
                  event.currentTarget.src = "/default_cover.webp";
                }}
              />
            )}
          </div>

          <div className="pointer-events-auto absolute inset-x-0 top-0 z-10 flex items-start justify-between p-1.5">
            {actions ? (
              <div className="max-md:opacity-100 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                {actions}
              </div>
            ) : (
              <span />
            )}
            {likeTrackId ? (
              <LikeButton
                trackId={likeTrackId}
                className="bg-background/80 pointer-events-auto backdrop-blur-sm max-md:opacity-100 md:opacity-0 md:transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100"
              />
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-sm font-medium",
              isPlaying && "text-primary",
            )}
          >
            {title}
          </p>
          {subtitle || meta ? (
            <p className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
              {subtitle ? <span className="truncate">{subtitle}</span> : null}
              {meta ? (
                <>
                  <span aria-hidden="true" className="shrink-0">
                    ·
                  </span>
                  <span className="shrink-0">{meta}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
