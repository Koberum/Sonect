import { getCoverPath } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { TrackWithRelations } from "@repo/types";

type PlaybackTrack = {
  track: TrackWithRelations;
};

export function PlayedTrack({ track }: PlaybackTrack): React.ReactElement {
  return (
    <div className="flex h-full items-center gap-2 p-2">
      <img
        src={getCoverPath(track.cover_path)}
        alt={track.title}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.src = "/default_cover.png";
        }}
        className="aspect-square size-10 shrink-0 rounded-md md:size-12"
      />
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
