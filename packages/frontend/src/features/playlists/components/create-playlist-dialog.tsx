import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          className="space-y-4"
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("playlist.namePlaceholder")}
            autoFocus
          />
          {createMut.isError ? (
            <p className="text-destructive text-sm">
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
