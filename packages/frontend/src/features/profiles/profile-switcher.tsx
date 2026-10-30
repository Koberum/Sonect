import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ChevronsUpDown,
  KeyRound,
  LogOut,
  Pencil,
  Plus,
  Settings,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Profile, PublicProfile } from "@repo/types";
import { useAuth } from "@/features/auth/auth-context";
import { authQueries } from "@/features/auth/queries";
import { getInitials } from "@/lib/avatar";
import { profileQueries } from "./queries";
import { CreateProfileForm } from "./components/create-profile-form";
import { SwitchProfileDialog } from "./components/switch-profile-dialog";
import { ChangePasswordDialog } from "./components/change-password-dialog";
import { EditProfileDialog } from "./components/edit-profile-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Candidate = Profile | PublicProfile;

export function ProfileSwitcher() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, isAdmin, logout } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [switchTarget, setSwitchTarget] = useState<PublicProfile | null>(null);

  const adminProfilesQuery = useQuery({
    ...profileQueries.list(),
    enabled: isAdmin,
  });
  const publicProfilesQuery = useQuery({
    ...authQueries.profiles(),
    enabled: !isAdmin,
  });

  if (!profile) return null;

  const candidates: Candidate[] = isAdmin
    ? (adminProfilesQuery.data ?? [])
    : (publicProfilesQuery.data ?? []);
  const isLoading = isAdmin
    ? adminProfilesQuery.isLoading
    : publicProfilesQuery.isLoading;
  const isError = isAdmin
    ? adminProfilesQuery.isError
    : publicProfilesQuery.isError;
  const refetch = isAdmin
    ? adminProfilesQuery.refetch
    : publicProfilesQuery.refetch;
  const adminCount =
    adminProfilesQuery.data?.filter((candidate) => candidate.role === "admin")
      .length ?? 0;
  const canDelete = !(editTarget?.role === "admin" && adminCount <= 1);

  const handleEdit = (candidate: Candidate): void => {
    if (!isAdmin) return;
    const full = adminProfilesQuery.data?.find(
      (item) => item.id === candidate.id,
    );
    if (full) setEditTarget(full);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
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
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>{t("profile.change")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {isLoading && (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-9 rounded-md" />
              <Skeleton className="h-9 rounded-md" />
            </div>
          )}
          {isError && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void refetch();
              }}
            >
              {t("profile.retry")}
            </DropdownMenuItem>
          )}
          {candidates.map((candidate) => {
            const isCurrent = candidate.id === profile.id;
            return (
              <div key={candidate.id} className="flex items-center gap-0">
                <DropdownMenuItem
                  disabled={isCurrent}
                  onSelect={() => setSwitchTarget(candidate)}
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
                  {isCurrent && <Check className="size-4 shrink-0" />}
                </DropdownMenuItem>
                {isAdmin && (
                  <Button
                    type="button"
                    variant="bare"
                    size="icon-sm"
                    aria-label={`${t("profile.editTitle")}: ${candidate.name}`}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleEdit(candidate);
                    }}
                    className="mr-1 shrink-0"
                  >
                    <Pencil className="opacity-60 hover:opacity-100" />
                  </Button>
                )}
              </div>
            );
          })}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setCreateOpen(true);
                }}
              >
                <Plus className="size-4" />
                {t("profile.addProfile")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate("/settings")}>
                <Settings className="size-4" />
                {t("settings.title")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setPasswordOpen(true);
            }}
          >
            <KeyRound className="size-4" />
            {t("auth.changePassword")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              void logout();
            }}
          >
            <LogOut className="size-4" />
            {t("auth.logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
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

      <SwitchProfileDialog
        target={switchTarget}
        onClose={() => setSwitchTarget(null)}
      />

      <ChangePasswordDialog
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />

      {isAdmin && (
        <EditProfileDialog
          profile={editTarget}
          canDelete={canDelete}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  );
}
