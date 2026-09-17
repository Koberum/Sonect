import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Profile } from "@repo/types";
import { useProfile } from "./profile-context";
import { getInitials, toSelectedProfile } from "@/lib/selectedProfile";
import { profileMutations, profileQueries } from "./queries";
import { CreateProfileForm } from "./components/create-profile-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvatarColorPicker } from "./components/avatar-color-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileSwitcher() {
  const { t } = useTranslation();
  const { profile, selectProfile } = useProfile();
  const { data: profiles } = useQuery(profileQueries.list());

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const updateMut = useMutation(profileMutations.update());
  const deleteMut = useMutation(profileMutations.remove());

  useEffect(() => {
    if (editTarget) {
      setEditName(editTarget.name);
      setEditColor(editTarget.avatarColor);
      setEditError(null);
      setDeleteConfirm(false);
    }
  }, [editTarget]);

  const handleSelect = (target: Profile): void => {
    selectProfile(toSelectedProfile(target));
  };

  const handleEditSave = async (): Promise<void> => {
    if (!editTarget) return;
    const trimmed = editName.trim();
    const data: { name?: string; avatarColor?: string } = {};
    if (trimmed && trimmed !== editTarget.name) data.name = trimmed;
    if (editColor !== editTarget.avatarColor) data.avatarColor = editColor;
    if (Object.keys(data).length === 0) {
      setEditTarget(null);
      return;
    }
    setEditError(null);
    try {
      const updated = await updateMut.mutateAsync({
        id: editTarget.id,
        ...data,
      });
      if (profile?.id === editTarget.id) {
        selectProfile(toSelectedProfile(updated));
      }
      setEditTarget(null);
    } catch {
      setEditError(t("profile.errors.update"));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!editTarget || !profiles || profiles.length <= 1 || deleteMut.isPending)
      return;
    try {
      await deleteMut.mutateAsync(editTarget.id);
      if (profile?.id === editTarget.id) {
        const remaining = profiles.filter((p) => p.id !== editTarget.id);
        if (remaining.length > 0)
          selectProfile(toSelectedProfile(remaining[0]));
      }
      setDeleteConfirm(false);
      setEditTarget(null);
    } catch {
      setEditError(t("profile.errors.remove"));
    }
  };

  if (!profile) return null;

  const canDelete = (profiles?.length ?? 0) > 1;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            aria-label={t("profile.switch")}
            className="h-8 gap-2 px-2"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback
                className="text-[10px] font-bold text-white"
                style={{ backgroundColor: profile.avatarColor }}
              >
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
              {profile.name}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{t("profile.change")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profiles?.map((candidate) => (
            <div key={candidate.id} className="flex items-center gap-0">
              <DropdownMenuItem
                onSelect={() => handleSelect(candidate)}
                className="flex flex-1 items-center gap-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback
                    className="text-xs font-bold text-white"
                    style={{ backgroundColor: candidate.avatarColor }}
                  >
                    {getInitials(candidate.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate text-sm font-medium">
                  {candidate.name}
                </span>
                {profile.id === candidate.id && (
                  <Check className="h-4 w-4 shrink-0" />
                )}
              </DropdownMenuItem>
              <button
                type="button"
                aria-label={`${t("profile.rename")}: ${candidate.name}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditTarget(candidate);
                }}
                className="hover:bg-accent mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded p-0"
              >
                <Pencil className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
              </button>
            </div>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("profile.addProfile")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create profile dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("profile.createTitle")}</DialogTitle>
            <DialogDescription>
              {t("profile.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <CreateProfileForm
            onCreated={() => setCreateOpen(false)}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit profile dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("profile.editTitle")}</DialogTitle>
            <DialogDescription>
              {t("profile.editDescription")}
            </DialogDescription>
          </DialogHeader>
          {editTarget && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-profile-name">
                  {t("profile.namePlaceholder")}
                </Label>
                <Input
                  id="edit-profile-name"
                  value={editName}
                  maxLength={50}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("profile.namePlaceholder")}
                  autoFocus
                />
              </div>
              <AvatarColorPicker
                value={editColor}
                onChange={setEditColor}
                previewName={editName}
              />
              {editError && (
                <p role="alert" className="text-destructive text-sm">
                  {editError}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  disabled={updateMut.isPending || !editName.trim()}
                  onClick={() => void handleEditSave()}
                  className="flex-1"
                >
                  {t("profile.save")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditTarget(null)}
                  className="flex-1"
                >
                  {t("common.cancel")}
                </Button>
              </div>
              {canDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive w-full"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t("profile.delete")}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("profile.deleteMessage", { name: editTarget?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("profile.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
