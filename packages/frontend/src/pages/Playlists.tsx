import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlaylistCard } from "@/features/catalog/components/media-card/playlist-card";
import { useQuery } from "@tanstack/react-query";
import { ListMusic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { playlistQueries } from "@/features/playlists/queries";
import { CreatePlaylistDialog } from "@/features/playlists/components/create-playlist-dialog";
import { useAuth } from "@/features/auth/auth-context";

export default function Playlists() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const [createOpen, setCreateOpen] = useState(false);
  const {
    data: playlists = [],
    isPending,
    isError,
    refetch,
  } = useQuery(playlistQueries.list(profileId));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {t("playlist.listCount", { count: playlists.length })}
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
          <p className="text-destructive text-sm">{t("playlist.loadError")}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : playlists.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title={t("playlist.emptyListTitle")}
          description={t("playlist.emptyListDescription")}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("playlist.new")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              className="w-full"
            />
          ))}
        </div>
      )}

      <CreatePlaylistDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
