import { useState } from "react";
import { playQueueItem, removeFromQueue } from "@/features/mpd/api";
import { getCoverPath } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ListMusic, X, Play } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import PlayStatus from "@/features/dashboard/components/play-status";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { mpdQueries } from "@/features/mpd/queries";
import { qk } from "@/lib/queryKeys";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface QueueViewProps {
  currentTrackFile?: string;
}

export function QueueView({ currentTrackFile }: QueueViewProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const { data: queue = [] } = useQuery({
    ...mpdQueries.queue(open),
    enabled: open,
  });

  const handlePlay = async (pos: number) => {
    await playQueueItem(pos);
  };

  const handleRemove = async (e: React.MouseEvent, pos: number) => {
    e.stopPropagation();
    await removeFromQueue(pos);
    qc.setQueryData(qk.mpd.queue(), (old: typeof queue) =>
      old ? old.filter((trk) => trk.pos !== pos) : old,
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
        >
          <ListMusic className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="mb-2 w-80 p-0"
        side="top"
        align="end"
        sideOffset={8}
      >
        <div className="p-3 pb-2">
          <h4 className="text-sm font-semibold">{t("queue.upNext")}</h4>
          <p className="text-muted-foreground text-xs">
            {t("queue.tracksInQueue", { count: queue.length })}
          </p>
        </div>
        <ScrollArea className="h-72">
          <div className="space-y-0">
            {queue.map((track) => {
              const isCurrent = track.file === currentTrackFile;
              return (
                <div
                  key={track.mpdId}
                  className={`group hover:bg-accent/50 flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors`}
                  onClick={() => !isCurrent && handlePlay(track.pos)}
                >
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded">
                    {isCurrent && (
                      <PlayStatus
                        variant="white"
                        className="absolute inset-2 flex items-center justify-center"
                      />
                    )}
                    <img
                      src={getCoverPath(track.cover_path)}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "/default_cover.png";
                      }}
                      className="h-full w-full object-cover"
                    />
                    {!isCurrent && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                        <Play
                          className="h-4 w-4 text-white"
                          fill="currentColor"
                        />
                      </div>
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
                    {formatTime(track.duration)}
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
      </PopoverContent>
    </Popover>
  );
}
