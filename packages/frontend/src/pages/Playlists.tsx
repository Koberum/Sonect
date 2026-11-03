import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListMusic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { playlistQueries } from "@/features/playlists/queries";
import { CreatePlaylistDialog } from "@/features/playlists/components/create-playlist-dialog";

export default function Playlists() {
  const { t } = useTranslation();
  const [createOpen, setCreateOpen] = useState(false);
  const {
    data: playlists = [],
    isPending,
    isError,
    refetch,
  } = useQuery(playlistQueries.list());

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {t("playlists.count", { count: playlists.length })}
        </p>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("playlist.new")}
        </Button>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="border-destructive/40 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <p className="text-destructive text-sm">{t("playlists.loadError")}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : playlists.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title={t("playlists.emptyTitle")}
          description={t("playlists.emptyDescription")}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("playlist.new")}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist) => (
            <Link
              key={playlist.id}
              to={`/home/playlists/${playlist.id}`}
              className="bg-card hover:bg-muted/60 flex items-center gap-4 rounded-xl p-4 shadow-sm transition-colors"
            >
              <span className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-lg">
                <ListMusic className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {playlist.name}
                </span>
                {playlist.description ? (
                  <span className="text-muted-foreground block truncate text-sm">
                    {playlist.description}
                  </span>
                ) : null}
              </span>
            </Link>
          ))}
        </div>
      )}

      <CreatePlaylistDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
