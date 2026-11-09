import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ListMusic, Loader2, Plus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  playlistMutations,
  playlistQueries,
} from "@/features/playlists/queries";
import { useAuth } from "@/features/auth/auth-context";

interface AddToPlaylistDialogProps {
  trackId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddToPlaylistDialog({
  trackId,
  open,
  onOpenChange,
}: AddToPlaylistDialogProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const { data: playlists = [], isPending } = useQuery({
    ...playlistQueries.list(profileId),
    enabled: open && !!profileId,
  });
  const addTrackMut = useMutation(playlistMutations.addTrack(profileId));
  const createMut = useMutation(playlistMutations.create(profileId));
  const [newName, setNewName] = useState("");

  const pending = addTrackMut.isPending || createMut.isPending;

  const handleAdd = async (playlistId: number) => {
    try {
      await addTrackMut.mutateAsync({ playlistId, trackId });
      toast(t("playlist.trackAdded"));
      onOpenChange(false);
    } catch {
      toast.error(t("playlist.trackAddError"));
    }
  };

  const handleCreateAndAdd = async () => {
    const name = newName.trim();
    if (!name || pending) return;
    try {
      const playlist = await createMut.mutateAsync({ name });
      await addTrackMut.mutateAsync({ playlistId: playlist.id, trackId });
      setNewName("");
      toast(t("playlist.trackAdded"));
      onOpenChange(false);
    } catch {
      toast.error(t("playlist.trackAddError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("contextMenu.addToPlaylist")}</DialogTitle>
          <DialogDescription>
            {t("playlist.addToDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : playlists.length === 0 ? (
            <EmptyState
              icon={ListMusic}
              title={t("trackActions.noPlaylists")}
            />
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {playlists.map((playlist) => (
                <Button
                  key={playlist.id}
                  type="button"
                  variant="ghost"
                  className="h-10 w-full justify-start gap-2"
                  disabled={pending}
                  onClick={() => void handleAdd(playlist.id)}
                >
                  <ListMusic className="size-4" />
                  <span className="truncate">{playlist.name}</span>
                </Button>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateAndAdd();
            }}
            className="space-y-2"
          >
            <Label htmlFor="add-to-playlist-name">
              {t("playlist.nameLabel")}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="add-to-playlist-name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t("playlist.namePlaceholder")}
                disabled={pending}
              />
              <Button
                type="submit"
                className="shrink-0"
                disabled={!newName.trim() || pending}
              >
                {pending ? <Loader2 className="animate-spin" /> : <Plus />}
                {t("playlist.create")}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
