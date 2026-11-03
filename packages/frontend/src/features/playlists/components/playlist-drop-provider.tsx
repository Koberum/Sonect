import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ListMusic, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageCollage } from "@/features/catalog/components/media-card/image-collage";
import { cn, getCoverPath } from "@/lib/utils";
import { playlistMutations, playlistQueries } from "../queries";
import { getTrackDragId, isTrackDrag } from "../track-drag";
import { CreatePlaylistDialog } from "./create-playlist-dialog";

interface TrackDragContextValue {
  startDrag(trackId: number): void;
  endDrag(): void;
}

const TrackDragContext = createContext<TrackDragContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useTrackDrag(): TrackDragContextValue {
  const context = useContext(TrackDragContext);
  if (!context) {
    throw new Error("useTrackDrag must be used within PlaylistDropProvider");
  }
  return context;
}

export function PlaylistDropProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [dragTrackId, setDragTrackId] = useState<number | null>(null);
  const [overPlaylistId, setOverPlaylistId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: playlists = [], isPending } = useQuery({
    ...playlistQueries.list(),
    enabled: open,
  });
  const addTrackMut = useMutation(playlistMutations.addTrack());

  const endDrag = useCallback(() => {
    setOpen(false);
    setOverPlaylistId(null);
  }, []);

  const startDrag = useCallback((trackId: number) => {
    setDragTrackId(trackId);
    setOpen(true);
  }, []);

  useEffect(() => {
    // Covers drags that finish outside any drop target.
    document.addEventListener("dragend", endDrag);
    return () => document.removeEventListener("dragend", endDrag);
  }, [endDrag]);

  const addTrack = useCallback(
    async (playlistId: number, trackId: number) => {
      try {
        await addTrackMut.mutateAsync({ playlistId, trackId });
        toast(t("playlist.trackAdded"));
        endDrag();
      } catch {
        toast.error(t("playlist.trackAddError"));
      }
    },
    [addTrackMut, endDrag, t],
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>, playlistId: number) => {
    event.preventDefault();
    const trackId = getTrackDragId(event.dataTransfer) ?? dragTrackId;
    setOverPlaylistId(null);
    if (trackId !== null) void addTrack(playlistId, trackId);
  };

  return (
    <TrackDragContext.Provider value={{ startDrag, endDrag }}>
      {children}

      <aside
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "bg-background fixed inset-y-0 right-0 z-50 flex w-80 max-w-[85vw] flex-col border-l shadow-lg transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-4 pb-2">
          <h2 className="text-sm font-semibold">
            {t("contextMenu.addToPlaylist")}
          </h2>
          <Button
            type="button"
            variant="bare"
            size="icon-sm"
            onClick={endDrag}
            aria-label={t("common.close")}
          >
            <X />
          </Button>
        </div>
        <p className="text-muted-foreground px-4 pb-3 text-xs">
          {t("playlist.dropHint")}
        </p>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-1 px-2 pb-2">
            {isPending ? (
              Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full rounded-lg" />
              ))
            ) : playlists.length === 0 ? (
              <EmptyState
                icon={ListMusic}
                title={t("trackActions.noPlaylists")}
              />
            ) : (
              playlists.map((playlist) => {
                const previews = playlist.coverPreviews ?? [];
                const isOver = overPlaylistId === playlist.id;
                return (
                  <div
                    key={playlist.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      dragTrackId !== null &&
                      void addTrack(playlist.id, dragTrackId)
                    }
                    onKeyDown={(event) => {
                      if (
                        dragTrackId !== null &&
                        (event.key === "Enter" || event.key === " ")
                      ) {
                        event.preventDefault();
                        void addTrack(playlist.id, dragTrackId);
                      }
                    }}
                    onDragOver={(event) => {
                      if (!isTrackDrag(event.dataTransfer)) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "copy";
                      if (overPlaylistId !== playlist.id) {
                        setOverPlaylistId(playlist.id);
                      }
                    }}
                    onDragLeave={(event) => {
                      if (
                        event.currentTarget.contains(
                          event.relatedTarget as Node | null,
                        )
                      ) {
                        return;
                      }
                      setOverPlaylistId((current) =>
                        current === playlist.id ? null : current,
                      );
                    }}
                    onDrop={(event) => handleDrop(event, playlist.id)}
                    className={cn(
                      "hover:bg-muted/60 focus-visible:ring-ring flex cursor-pointer items-center gap-3 rounded-lg border p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      isOver && "ring-primary bg-primary/10 ring-2",
                    )}
                  >
                    <div className="bg-muted size-12 shrink-0 overflow-hidden rounded-md">
                      {previews.length > 0 ? (
                        <ImageCollage
                          images={previews.map((preview) =>
                            getCoverPath(preview),
                          )}
                          aspectRatio="square"
                        />
                      ) : (
                        <img
                          src={getCoverPath()}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">
                        {playlist.name}
                      </p>
                      {playlist.description ? (
                        <p className="text-muted-foreground line-clamp-1 text-xs">
                          {playlist.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setCreateOpen(true)}
          >
            <Plus />
            {t("playlist.new")}
          </Button>
        </div>

        <CreatePlaylistDialog open={createOpen} onOpenChange={setCreateOpen} />
      </aside>
    </TrackDragContext.Provider>
  );
}
