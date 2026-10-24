import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Profile, ProfileRole } from "@repo/types";
import { ApiError } from "@/lib/api";
import { profileMutations } from "../queries";
import { AvatarColorPicker } from "./avatar-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EditProfileDialogProps = {
  profile: Profile | null;
  canDelete: boolean;
  onClose: () => void;
};

function isLastAdminConflict(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 409) return false;
  const message =
    err.body &&
    typeof err.body === "object" &&
    "error" in (err.body as Record<string, unknown>)
      ? String((err.body as Record<string, unknown>).error)
      : err.message;
  return /last administrator/i.test(message);
}

export function EditProfileDialog({
  profile,
  canDelete,
  onClose,
}: EditProfileDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [role, setRole] = useState<ProfileRole>("user");
  const [error, setError] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const updateMut = useMutation(profileMutations.update());
  const resetMut = useMutation(profileMutations.resetPassword());
  const removeMut = useMutation(profileMutations.remove());

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setColor(profile.avatarColor);
    setRole(profile.role);
    setError(null);
    setResetPassword("");
    setResetError(null);
    setDeleteConfirm(false);
  }, [profile]);

  const handleSave = async (): Promise<void> => {
    if (!profile) return;
    const trimmed = name.trim();
    if (!trimmed || updateMut.isPending) return;
    const data: { name?: string; avatarColor?: string; role?: ProfileRole } =
      {};
    if (trimmed !== profile.name) data.name = trimmed;
    if (color !== profile.avatarColor) data.avatarColor = color;
    if (role !== profile.role) data.role = role;
    if (Object.keys(data).length === 0) {
      onClose();
      return;
    }
    setError(null);
    try {
      await updateMut.mutateAsync({ id: profile.id, ...data });
      onClose();
    } catch (err) {
      setError(
        isLastAdminConflict(err)
          ? t("auth.lastAdmin")
          : t("profile.errors.update"),
      );
    }
  };

  const handleResetPassword = async (): Promise<void> => {
    if (!profile || resetMut.isPending) return;
    if (resetPassword.length < 8) {
      setResetError(t("auth.passwordTooShort"));
      return;
    }
    setResetError(null);
    try {
      await resetMut.mutateAsync({ id: profile.id, password: resetPassword });
      setResetPassword("");
      toast.success(t("auth.resetPasswordDone"));
    } catch {
      setResetError(t("auth.resetPasswordError"));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!profile || !canDelete || removeMut.isPending) return;
    setError(null);
    try {
      await removeMut.mutateAsync(profile.id);
      setDeleteConfirm(false);
      onClose();
    } catch (err) {
      setDeleteConfirm(false);
      setError(
        isLastAdminConflict(err)
          ? t("auth.lastAdmin")
          : t("profile.errors.remove"),
      );
    }
  };

  return (
    <Dialog open={!!profile} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("profile.editTitle")}</DialogTitle>
          <DialogDescription>{t("profile.editDescription")}</DialogDescription>
        </DialogHeader>

        {profile && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-profile-name">
                {t("profile.namePlaceholder")}
              </Label>
              <Input
                id="edit-profile-name"
                value={name}
                maxLength={50}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("profile.namePlaceholder")}
                autoFocus
              />
            </div>

            <AvatarColorPicker
              value={color}
              onChange={setColor}
              previewName={name}
            />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-profile-role">{t("auth.role")}</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as ProfileRole)}
              >
                <SelectTrigger id="edit-profile-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">{t("auth.roleUser")}</SelectItem>
                  <SelectItem value="admin">{t("auth.roleAdmin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}

            <div className="border-border flex flex-col gap-2 rounded-lg border p-3">
              <Label htmlFor="edit-profile-password">
                {t("auth.resetPassword")}
              </Label>
              <p className="text-muted-foreground text-xs">
                {t("auth.resetPasswordDescription", { name: profile.name })}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="edit-profile-password"
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  autoComplete="new-password"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!resetPassword || resetMut.isPending}
                  onClick={() => void handleResetPassword()}
                >
                  {resetMut.isPending && <Loader2 className="animate-spin" />}
                  {t("auth.resetPassword")}
                </Button>
              </div>
              {resetError && (
                <p role="alert" className="text-destructive text-sm">
                  {resetError}
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                disabled={!canDelete || removeMut.isPending}
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 />
                {t("profile.delete")}
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={updateMut.isPending}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={!name.trim() || updateMut.isPending}
                  onClick={() => void handleSave()}
                >
                  {updateMut.isPending && <Loader2 className="animate-spin" />}
                  {t("profile.save")}
                </Button>
              </div>
            </DialogFooter>

            {!canDelete && (
              <p role="note" className="text-muted-foreground text-xs">
                {t("auth.lastAdmin")}
              </p>
            )}
          </div>
        )}
      </DialogContent>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("profile.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("profile.deleteMessage", { name: profile?.name ?? "" })}
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
    </Dialog>
  );
}
