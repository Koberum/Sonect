import { PlaybackControls } from "./playback-controls";
import { PlaybackWaveform } from "./playback-waveform";
import { usePlaybackContext } from "@/components/playback-context";
import { getCoverPath } from "@/lib/utils";
import { PlaybackErrorNotice } from "./playback-error";
import { LikeButton } from "@/features/liked/components/like-button";
import { usePlayerEngine } from "../player-engine-context";
import { OutputSelector } from "./output-selector";

export function FullPagePlayer() {
  const { trackPlayed, playbackStatus } = usePlaybackContext();
  const { displayElapsed } = usePlayerEngine();

  if (!trackPlayed) return null;

  const cover = getCoverPath(trackPlayed.cover_path);

  return (
    <div className="relative isolate flex h-full flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      >
        <img
          src={cover}
          alt=""
          className="h-full w-full scale-110 object-cover opacity-50 blur-2xl saturate-150"
          onError={(e) => {
            e.currentTarget.src = "/default_cover.webp";
          }}
        />
        <div className="from-background/15 via-background/50 to-background/85 absolute inset-0 bg-gradient-to-b" />
      </div>

      <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col gap-4 px-5 py-4">
        <div className="flex shrink-0 items-center justify-end gap-1">
          <LikeButton
            trackId={trackPlayed.id ?? playbackStatus.track?.id ?? null}
          />
          <OutputSelector />
        </div>

        <PlaybackErrorNotice
          error={playbackStatus.error}
          className="shrink-0 rounded-lg"
        />

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden landscape:hidden">
          <img
            src={cover}
            alt={trackPlayed.title}
            className="aspect-square w-[min(100%,calc(100dvh-23rem))] rounded-xl object-cover shadow-2xl"
            onError={(e) => {
              e.currentTarget.src = "/default_cover.webp";
            }}
          />
        </div>

        <div className="min-w-0 shrink-0 text-left">
          <h2 className="truncate text-xl leading-tight font-semibold">
            {trackPlayed.title}
          </h2>
          <p className="text-muted-foreground mt-1 truncate text-sm">
            {trackPlayed.artist_name}
            {trackPlayed.album_title
              ? ` \u00b7 ${trackPlayed.album_title}`
              : ""}
          </p>
        </div>

        <div className="shrink-0">
          <PlaybackWaveform
            elapsed={displayElapsed}
            duration={playbackStatus.duration}
            trackId={trackPlayed.id ?? playbackStatus.track?.id ?? null}
            className="w-full"
          />
        </div>

        <div className="flex shrink-0 justify-center">
          <PlaybackControls
            playbackStatus={playbackStatus}
            track={trackPlayed}
            size="large"
          />
        </div>
      </div>
    </div>
  );
}
