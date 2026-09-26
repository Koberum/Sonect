import { PlusCircle, ListMusic } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  playlistQueries,
  playlistMutations,
} from "@/features/playlists/queries";

interface AddToPlaylistMenuProps {
  trackId: number;
  onAdded?: () => void;
}

export function AddToPlaylistMenu({
  trackId,
  onAdded,
}: AddToPlaylistMenuProps) {
  const { t } = useTranslation();
  const { data: playlists = [] } = useQuery(playlistQueries.list());
  const addTrackMut = useMutation(playlistMutations.addTrack());
  const createMut = useMutation(playlistMutations.create());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const handleAdd = async (playlistId: number) => {
    try {
      await addTrackMut.mutateAsync({ playlistId, trackId });
      toast(t("playlist.trackAdded"));
      onAdded?.();
    } catch {
      toast(t("playlist.trackAddError"));
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newName.trim()) return;
    try {
      const playlist = await createMut.mutateAsync({ name: newName.trim() });
      await addTrackMut.mutateAsync({ playlistId: playlist.id, trackId });
      setNewName("");
      setDialogOpen(false);
      toast(t("playlist.trackAdded"));
      onAdded?.();
    } catch {
      toast(t("playlist.trackAddError"));
    }
  };

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        {t("contextMenu.addToPlaylist")}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-48">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <ContextMenuItem onSelect={(e) => e.preventDefault()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {t("contextMenu.newPlaylist")}
            </ContextMenuItem>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("playlist.new")}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateAndAdd();
              }}
              className="space-y-4"
            >
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("playlist.namePlaceholder")}
                autoFocus
              />
              <Button type="submit" className="w-full">
                {t("playlist.create")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        <ContextMenuSeparator />
        {playlists.map((playlist) => (
          <ContextMenuItem
            key={playlist.id}
            onClick={() => handleAdd(playlist.id)}
          >
            <ListMusic className="mr-2 h-4 w-4" />
            {playlist.name}
          </ContextMenuItem>
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
