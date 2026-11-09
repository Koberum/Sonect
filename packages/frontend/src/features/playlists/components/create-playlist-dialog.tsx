import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
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
import { playlistMutations } from "@/features/playlists/queries";
import { useAuth } from "@/features/auth/auth-context";

export interface CreatePlaylistDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function CreatePlaylistDialog({
  open,
  onOpenChange,
}: CreatePlaylistDialogProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const createMut = useMutation(playlistMutations.create(profileId));
  const [name, setName] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      await createMut.mutateAsync({ name: name.trim() });
      setName("");
      onOpenChange(false);
    } catch {
      // the mutation error is rendered inside the dialog
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("playlist.new")}</DialogTitle>
          <DialogDescription>{t("playlist.newDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="create-playlist-name">
              {t("playlist.nameLabel")}
            </Label>
            <Input
              id="create-playlist-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("playlist.namePlaceholder")}
              autoFocus
            />
          </div>
          {createMut.isError ? (
            <p role="alert" className="text-destructive text-sm">
              {t("playlist.createError")}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            disabled={!name.trim() || createMut.isPending}
          >
            {t("playlist.create")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
