import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PlaylistCard } from "@/features/catalog/components/media-card/playlist-card";
import { MediaGrid } from "@/features/catalog/components/media-grid";
import { useQuery } from "@tanstack/react-query";
import { ListMusic, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { QueryError } from "@/components/ui/query-error";
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
      <PageHeader
        title={t("playlist.title")}
        description={t("playlist.listCount", { count: playlists.length })}
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("playlist.new")}
          </Button>
        }
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <QueryError
          message={t("playlist.loadError")}
          onRetry={() => void refetch()}
        />
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
        <MediaGrid>
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              className="w-full"
            />
          ))}
        </MediaGrid>
      )}

      <CreatePlaylistDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
