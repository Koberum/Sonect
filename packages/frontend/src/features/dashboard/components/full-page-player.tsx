import { useTranslation } from "react-i18next";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlaybackControls } from "./playback-controls";
import { PlaybackWaveform } from "./playback-waveform";
import { usePlaybackContext } from "@/components/playback-context";
import { getCoverPath } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  playSong,
  pauseSong,
  resumeSong,
  nextTrack,
  previousTrack,
  setRandom,
  setRepeat,
  playQueueItem,
  removeFromQueue,
} from "@/features/player/api";
import VolumeControls from "./volume-controls";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { playerQueries } from "@/features/player/queries";
import { qk } from "@/lib/queryKeys";
import PlayStatus from "./play-status";

interface FullPagePlayerProps {
  displayElapsed: number;
  browserVolume: number;
  browserSetVolume: (vol: number) => void;
  open?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FullPagePlayer({
  displayElapsed,
  browserVolume,
  browserSetVolume,
  open = true,
}: FullPagePlayerProps) {
  const { t } = useTranslation();
  const { trackPlayed, playbackStatus, outputMode } = usePlaybackContext();
  const qc = useQueryClient();
  const { data: queue = [] } = useQuery(playerQueries.queue(open));
  const doToggle = (fn: () => Promise<void>) => fn();

  const handlePlay = async (pos: number) => {
    await playQueueItem(pos);
    await qc.invalidateQueries({ queryKey: qk.player.queue() });
  };

  const handleRemove = async (e: React.MouseEvent, pos: number) => {
    e.stopPropagation();
    await removeFromQueue(pos);
    qc.setQueryData(qk.player.queue(), (old: typeof queue) =>
      old ? old.filter((tr) => tr.pos !== pos) : old,
    );
    await qc.invalidateQueries({ queryKey: qk.player.queue() });
  };

  if (!trackPlayed) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-2 pb-4">
        <h2 className="text-center text-sm font-semibold">
          {t("player.title")}
        </h2>
      </div>

      <div className="flex justify-center px-6">
        <img
          src={getCoverPath(trackPlayed.cover_path)}
          alt={trackPlayed.title}
          className="aspect-square w-[60vw] max-w-[300px] rounded-xl object-cover shadow-lg"
          onError={(e) => {
            e.currentTarget.src = "/default_cover.png";
          }}
        />
      </div>

      <div className="px-6 pt-4 pb-2 text-center">
        <h3 className="truncate text-lg font-semibold">{trackPlayed.title}</h3>
        <p className="text-muted-foreground truncate text-sm">
          {trackPlayed.artist_name}
          {trackPlayed.album_title ? ` \u00b7 ${trackPlayed.album_title}` : ""}
        </p>
      </div>

      <div className="px-6 py-2">
        <PlaybackWaveform
          elapsed={displayElapsed}
          duration={playbackStatus.duration}
          trackId={trackPlayed.id ?? playbackStatus.track?.id ?? null}
          className="w-full"
          outputMode={outputMode}
        />
      </div>

      <div className="flex justify-center px-6 py-2">
        <PlaybackControls
          playbackStatus={playbackStatus}
          playTrack={() => {
            if (trackPlayed) return playSong(trackPlayed);
          }}
          pauseTrack={() => pauseSong()}
          resumeTrack={() => resumeSong()}
          nextTrack={() => nextTrack()}
          previousTrack={() => previousTrack()}
          setRandom={(enabled) => doToggle(() => setRandom(enabled))}
          setRepeat={(enabled) => doToggle(() => setRepeat(enabled))}
          showAllControls
        />
      </div>

      <div className="flex justify-center px-6 py-2">
        <VolumeControls
          volume={
            outputMode === "browser" ? browserVolume : playbackStatus.volume
          }
          onVolumeCommit={
            outputMode === "browser" ? browserSetVolume : undefined
          }
        />
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="px-6 pb-2">
          <h4 className="text-sm font-semibold">{t("queue.upNext")}</h4>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-0 px-3">
            {queue.map((track) => {
              const isCurrent = track.file === playbackStatus.track?.file;
              return (
                <div
                  key={`${track.mpdId}-${track.pos}`}
                  className={`group hover:bg-accent/50 flex cursor-pointer items-center gap-2 overflow-hidden rounded-md px-3 py-2 transition-colors`}
                  onClick={() => !isCurrent && handlePlay(track.pos)}
                >
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                    <img
                      src={getCoverPath(track.cover_path)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "/default_cover.png";
                      }}
                      className="h-full w-full object-cover"
                    />
                    {!isCurrent ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play
                          className="h-4 w-4 text-white"
                          fill="currentColor"
                        />
                      </div>
                    ) : (
                      <PlayStatus
                        variant="white"
                        className="absolute inset-2 flex items-center justify-center"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${
                        isCurrent ? "text-primary font-medium" : "font-medium"
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {track.artist_name}
                    </p>
                  </div>

                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDuration(track.duration)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:!opacity-100"
                    onClick={(e) => handleRemove(e, track.pos)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
