import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { DBProfile } from "@repo/types";
import { useProfile } from "./profile-context";
import {
  AVATAR_COLORS,
  getInitials,
  toSelectedProfile,
} from "@/lib/selectedProfile";
import { profileMutations, profileQueries } from "./queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ProfilePickerProps = {
  mode: "page" | "modal";
  onDone?: () => void;
};

export function ProfilePicker({ mode, onDone }: ProfilePickerProps) {
  const { t } = useTranslation();
  const { profile, selectProfile } = useProfile();
  const {
    data: profiles,
    isLoading,
    isError,
  } = useQuery(profileQueries.list());

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(AVATAR_COLORS[0]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameColor, setRenameColor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation(profileMutations.create());
  const updateMut = useMutation(profileMutations.update());
  const deleteMut = useMutation(profileMutations.remove());

  const busy =
    createMut.isPending || updateMut.isPending || deleteMut.isPending;

  const handleSelect = (target: DBProfile): void => {
    selectProfile(toSelectedProfile(target));
    onDone?.();
  };

  const handleCreate = async (): Promise<void> => {
    const name = newName.trim();
    if (!name || busy) return;
    setError(null);
    try {
      const created = await createMut.mutateAsync({
        name,
        avatarColor: newColor,
      });
      setNewName("");
      selectProfile(toSelectedProfile(created));
      onDone?.();
    } catch {
      setError(t("profile.errors.create"));
    }
  };

  const startRename = (target: DBProfile): void => {
    setRenamingId(target.id);
    setRenameValue(target.name);
    setRenameColor(target.avatar_color);
  };

  const handleRename = async (target: DBProfile): Promise<void> => {
    const name = renameValue.trim();
    const data: { name?: string; avatarColor?: string } = {};
    if (name && name !== target.name) data.name = name;
    if (renameColor && renameColor !== target.avatar_color)
      data.avatarColor = renameColor;
    if (Object.keys(data).length === 0 || busy) {
      setRenamingId(null);
      return;
    }
    setError(null);
    try {
      await updateMut.mutateAsync({ id: target.id, ...data });
      setRenamingId(null);
    } catch {
      setError(t("profile.errors.update"));
    }
  };

  const handleDelete = async (target: DBProfile): Promise<void> => {
    if (!profiles || profiles.length <= 1 || busy) return;
    setError(null);
    try {
      await deleteMut.mutateAsync(target.id);
      if (profile?.id === target.id) {
        const remaining = profiles.filter((u) => u.id !== target.id);
        if (remaining.length > 0)
          selectProfile(toSelectedProfile(remaining[0]));
      }
      setDeleteTarget(null);
    } catch {
      setError(t("profile.errors.remove"));
    }
  };

  const isPage = mode === "page";

  return (
    <div
      className={isPage ? "mx-auto w-full max-w-3xl px-4 py-10" : "px-1 py-2"}
    >
      <h2
        className={
          isPage
            ? "text-center text-2xl font-semibold"
            : "text-lg font-semibold"
        }
      >
        {t("profile.title")}
      </h2>

      {error && (
        <p
          role="status"
          aria-live="polite"
          className="text-destructive mt-4 text-center text-sm"
        >
          {error}
        </p>
      )}

      {isLoading ? (
        <p role="status" className="mt-8 text-center text-sm">
          {t("common.loading")}
        </p>
      ) : isError ? (
        <p role="alert" className="mt-8 text-center text-sm">
          {t("profile.errors.load")}
        </p>
      ) : (
        profiles && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {profiles.map((candidate) => {
                const selected = profile?.id === candidate.id;
                const renaming = renamingId === candidate.id;
                return (
                  <div
                    key={candidate.id}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-4 ${selected ? "border-primary" : "border-border"}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(candidate)}
                      aria-label={`${t("profile.select")}: ${candidate.name}`}
                      aria-pressed={selected}
                      className="flex min-h-11 w-full flex-col items-center gap-2"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: candidate.avatar_color }}
                      >
                        {getInitials(candidate.name)}
                      </span>
                      {renaming ? (
                        <span className="sr-only">{candidate.name}</span>
                      ) : (
                        <span className="w-full truncate text-center text-sm font-medium">
                          {candidate.name}
                        </span>
                      )}
                    </button>

                    {renaming ? (
                      <div className="flex w-full flex-col gap-2">
                        <Input
                          value={renameValue}
                          maxLength={50}
                          onChange={(e) => setRenameValue(e.target.value)}
                          placeholder={t("profile.namePlaceholder")}
                          aria-label={t("profile.namePlaceholder")}
                        />
                        <div
                          role="radiogroup"
                          aria-label={t("profile.color")}
                          className="flex flex-wrap justify-center gap-1.5"
                        >
                          {AVATAR_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              role="radio"
                              aria-checked={renameColor === color}
                              aria-label={color}
                              onClick={() => setRenameColor(color)}
                              style={{ backgroundColor: color }}
                              className={`h-7 w-7 rounded-full ${renameColor === color ? "ring-primary ring-2 ring-offset-2" : ""}`}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => void handleRename(candidate)}
                            className="flex-1"
                          >
                            {t("profile.save")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setRenamingId(null)}
                            className="flex-1"
                          >
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`${t("profile.rename")}: ${candidate.name}`}
                          onClick={() => startRename(candidate)}
                          className="min-h-11 min-w-11"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={profiles.length <= 1}
                          aria-label={`${t("profile.delete")}: ${candidate.name}`}
                          onClick={() => setDeleteTarget(candidate)}
                          className="min-h-11 min-w-11"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {profiles.length <= 1 && (
              <p
                role="note"
                className="text-muted-foreground mt-4 text-center text-sm"
              >
                {t("profile.lastProfile")}
              </p>
            )}

            <div className="mx-auto mt-6 flex w-full max-w-sm flex-col gap-3">
              <div className="flex gap-2">
                <Input
                  value={newName}
                  maxLength={50}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                  }}
                  placeholder={t("profile.namePlaceholder")}
                  aria-label={t("profile.namePlaceholder")}
                />
                <Button
                  type="button"
                  disabled={!newName.trim() || busy}
                  onClick={() => void handleCreate()}
                  aria-label={t("profile.create")}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t("profile.create")}
                  </span>
                </Button>
              </div>
              <div
                role="radiogroup"
                aria-label={t("profile.color")}
                className="flex flex-wrap items-center justify-center gap-1.5"
              >
                <span className="text-muted-foreground mr-2 text-xs">
                  {t("profile.color")}:
                </span>
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={newColor === color}
                    aria-label={color}
                    onClick={() => setNewColor(color)}
                    style={{ backgroundColor: color }}
                    className={`h-7 w-7 rounded-full ${newColor === color ? "ring-primary ring-2 ring-offset-2" : ""}`}
                  />
                ))}
                {newName.trim() && (
                  <span
                    className="ml-2 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: newColor }}
                  >
                    {getInitials(newName.trim())}
                  </span>
                )}
              </div>
            </div>
          </>
        )
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("profile.deleteMessage", { name: deleteTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && void handleDelete(deleteTarget)}
            >
              {t("profile.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
