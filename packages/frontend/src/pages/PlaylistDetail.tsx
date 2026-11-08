import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { useAuth } from "@/features/auth/auth-context";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Play, Edit3, ListMusic } from "lucide-react";
import type { PlaylistTrack } from "@repo/types/catalog";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  playlistQueries,
  playlistMutations,
} from "@/features/playlists/queries";
import { TrackTable } from "@/features/tracks/components/track-table";

export default function PlaylistDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { play } = usePlayTrack();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const pid = id ? parseInt(id, 10) : 0;

  const { data: playlist, isPending } = useQuery({
    ...playlistQueries.detail(profileId, pid),
    enabled: !!pid && !!profileId,
  });

  const updateMut = useMutation(playlistMutations.update(profileId));
  const deleteMut = useMutation(playlistMutations.delete(profileId));
  const removeTrackMut = useMutation(playlistMutations.removeTrack(profileId));
  const loadMut = useMutation(playlistMutations.load());

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (playlist) {
      setEditName(playlist.name);
      setEditDesc(playlist.description || "");
    }
  }, [playlist]);

  const handlePlay = useCallback(
    async (track: PlaylistTrack) => {
      await play(track);
    },
    [play],
  );

  const handlePlayAll = useCallback(async () => {
    if (!playlist || playlist.tracks.length === 0) return;
    await loadMut.mutateAsync(playlist.id);
  }, [playlist, loadMut]);

  const handleDelete = async () => {
    if (!playlist) return;
    try {
      await deleteMut.mutateAsync(playlist.id);
      toast(t("playlist.deleted"));
      navigate("/playlists");
    } catch {
      toast.error(t("playlist.deleteError"));
    } finally {
      setDeleteOpen(false);
    }
  };

  const handleRemoveTrack = async (ptId: number) => {
    if (!playlist) return;
    try {
      await removeTrackMut.mutateAsync({ playlistId: playlist.id, ptId });
      toast(t("playlist.trackRemoved"));
    } catch {
      toast.error(t("playlist.trackRemovedError"));
    }
  };

  const handleEdit = async () => {
    if (!playlist || !editName.trim()) return;
    try {
      await updateMut.mutateAsync({
        id: playlist.id,
        data: {
          name: editName.trim(),
          description: editDesc.trim() || undefined,
        },
      });
      setEditOpen(false);
      toast(t("playlist.updated"));
    } catch {
      toast.error(t("playlist.updateError"));
    }
  };

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="mt-6 h-10 w-32" />
        <Separator className="my-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!playlist) return null;

  return (
    <div>
      <PageHeader
        title={playlist.name}
        description={
          playlist.tracks.length > 0
            ? t("playlist.trackCount", { count: playlist.tracks.length })
            : t("playlist.empty")
        }
        actions={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={handlePlayAll}
                    disabled={playlist.tracks.length === 0}
                  >
                    <Play fill="currentColor" />
                    {t("album.playAll")}
                  </Button>
                </span>
              </TooltipTrigger>
              {playlist.tracks.length === 0 && (
                <TooltipContent>{t("playlist.empty")}</TooltipContent>
              )}
            </Tooltip>

            <Sheet open={editOpen} onOpenChange={setEditOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <SheetTrigger asChild>
                    <Button
                      variant="bare"
                      size="icon-sm"
                      aria-label={t("playlist.edit")}
                    >
                      <Edit3 />
                    </Button>
                  </SheetTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("playlist.edit")}</TooltipContent>
              </Tooltip>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>{t("playlist.edit")}</SheetTitle>
                </SheetHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEdit();
                  }}
                  className="mt-6 space-y-4"
                >
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={t("playlist.namePlaceholder")}
                    autoFocus
                  />
                  <Input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder={t("playlist.descriptionPlaceholder")}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={updateMut.isPending}
                  >
                    {updateMut.isPending
                      ? t("common.saving")
                      : t("playlist.save")}
                  </Button>
                </form>
              </SheetContent>
            </Sheet>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="bare"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={t("playlist.delete")}
                    >
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("playlist.delete")}</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("playlist.deleteConfirmTitle")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("playlist.deleteConfirmDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteMut.isPending}
                    className={buttonVariants({ variant: "destructive" })}
                  >
                    {deleteMut.isPending
                      ? t("common.deleting")
                      : t("playlist.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />

      <Separator className="my-4" />

      {playlist.tracks.length > 0 ? (
        <TrackTable<PlaylistTrack>
          tracks={playlist.tracks}
          getKey={(track) => track.pt_id ?? track.id}
          showCover
          onPlay={(track) => void handlePlay(track)}
          onRemove={(track) => void handleRemoveTrack(track.pt_id)}
          removeLabel={t("playlist.removeTrack")}
        />
      ) : (
        <EmptyState icon={ListMusic} title={t("playlist.emptyDescription")} />
      )}
    </div>
  );
}
