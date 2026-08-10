import { getCoverPath } from "@/lib/utils";

type PlaybackTrack = {
  title: string;
  artist: string;
  cover_path?: string;
};

export function PlayedTrack({
  title,
  artist,
  cover_path,
}: PlaybackTrack): React.ReactElement {
  return (
    <div className="flex h-full items-center gap-2 p-2">
      <img
        src={getCoverPath(cover_path)}
        alt={title}
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
              {title}
            </span>
            <span className="ml-8 font-mono text-sm leading-none font-medium">
              {title}
            </span>
          </div>
        </div>
        <h3 className="hidden truncate font-mono text-sm leading-none font-medium md:block">
          {title}
        </h3>
        <p className="text-muted-foreground truncate text-xs">{artist}</p>
      </div>
    </div>
  );
}
