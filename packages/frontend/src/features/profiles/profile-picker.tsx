import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Profile } from "@repo/types";
import { useProfile } from "./profile-context";
import { toSelectedProfile } from "@/lib/selectedProfile";
import { profileMutations, profileQueries } from "./queries";
import { ProfileCard } from "./components/profile-card";
import { CreateProfileForm } from "./components/create-profile-form";
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
  onAdd?: () => void;
  onDone?: () => void;
};

export function ProfilePicker({ onAdd, onDone }: ProfilePickerProps) {
  const { t } = useTranslation();
  const { profile, selectProfile } = useProfile();
  const {
    data: profiles,
    isLoading,
    isError,
  } = useQuery(profileQueries.list());

  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deleteMut = useMutation(profileMutations.remove());

  const handleSelect = (target: Profile): void => {
    selectProfile(toSelectedProfile(target));
    onDone?.();
  };

  const handleDelete = async (target: Profile): Promise<void> => {
    if (!profiles || profiles.length <= 1 || deleteMut.isPending) return;
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

  if (isLoading) {
    return (
      <p role="status" className="py-8 text-center text-sm">
        {t("common.loading")}
      </p>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="py-8 text-center text-sm">
        {t("profile.errors.load")}
      </p>
    );
  }

  if (!profiles) return null;

  return (
    <>
      {error && (
        <p role="alert" className="text-destructive text-center text-sm">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {profiles.map((candidate) => (
          <ProfileCard
            key={candidate.id}
            profile={candidate}
            selected={profile?.id === candidate.id}
            canDelete={profiles.length > 1}
            onSelect={handleSelect}
            onDelete={setDeleteTarget}
          />
        ))}
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={t("profile.addProfile")}
            className="border-border text-muted-foreground hover:border-primary hover:text-foreground flex min-h-[132px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-4 transition-colors"
          >
            <span className="border-muted-foreground/30 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed">
              <Plus className="h-6 w-6" />
            </span>
            <span className="text-sm font-medium">
              {t("profile.addProfile")}
            </span>
          </button>
        )}
      </div>

      {profiles.length <= 1 && (
        <p role="note" className="text-muted-foreground text-center text-sm">
          {t("profile.lastProfile")}
        </p>
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
    </>
  );
}

export function ProfilePickerPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-center text-2xl font-semibold">
        {t("profile.title")}
      </h1>
      <div className="mt-6 flex flex-col gap-6">
        <ProfilePicker />
        <div className="mx-auto w-full max-w-sm">
          <CreateProfileForm autoFocus={false} />
        </div>
      </div>
    </div>
  );
}
