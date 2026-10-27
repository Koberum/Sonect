import { useTranslation } from "react-i18next";
import { getCoverPath } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { TrackWithRelations } from "@repo/types";

type PlaybackTrack = {
  track: TrackWithRelations;
};

export function PlayedTrack({ track }: PlaybackTrack): React.ReactElement {
  const { t } = useTranslation();
  const cover = (
    <img
      src={getCoverPath(track.cover_path)}
      alt={track.title}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.src = "/default_cover.png";
      }}
      className="aspect-square size-10 shrink-0 rounded-md object-cover md:size-12"
    />
  );

  return (
    <div className="flex h-full items-center gap-2 p-2">
      {track.album_id ? (
        <Link
          to={`/albums/${track.album_id}`}
          aria-label={t("album.goToAlbum")}
          onClick={(event) => event.stopPropagation()}
          className="focus-visible:ring-ring shrink-0 rounded-md transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {cover}
        </Link>
      ) : (
        cover
      )}
      <div className="ml-2 min-w-0 space-y-1">
        <div className="overflow-hidden md:hidden">
          <div className="animate-marquee flex whitespace-nowrap will-change-transform">
            <span className="font-mono text-sm leading-none font-medium">
              {track.title}
            </span>
            <span className="ml-8 font-mono text-sm leading-none font-medium">
              {track.title}
            </span>
          </div>
        </div>
        <h3 className="hidden truncate font-mono text-sm leading-none font-medium md:block">
          {track.title}
        </h3>

        <Link
          to={`/artists/${track.artist_id}/albums`}
          className="hover:underline"
        >
          <p className="text-muted-foreground truncate text-xs">
            {track.artist_name}
          </p>
        </Link>
      </div>
    </div>
  );
}
