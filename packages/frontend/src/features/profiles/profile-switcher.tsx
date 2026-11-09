import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, KeyRound, LogOut, Pencil, Plus, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Profile, PublicProfile } from "@repo/types";
import { useAuth } from "@/features/auth/auth-context";
import { authQueries } from "@/features/auth/queries";
import { getInitials } from "@/lib/avatar";
import { useHoverPopover } from "@/hooks/useHoverPopover";
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
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

type Candidate = Profile | PublicProfile;

type MenuRowProps = {
  icon?: typeof Plus;
  label: string;
  onClick: () => void;
};

function MenuRow({ icon: Icon, label, onClick }: MenuRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-accent focus-visible:ring-ring/50 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-[3px]"
    >
      {Icon ? <Icon className="text-muted-foreground size-4 shrink-0" /> : null}
      <span className="truncate">{label}</span>
    </button>
  );
}

function MenuSeparator() {
  return <div role="separator" className="bg-border my-1 h-px" />;
}

export function ProfileSwitcher() {
  const { t } = useTranslation();
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

  const {
    open,
    close,
    anchorRef,
    contentRef,
    triggerProps,
    contentProps,
    onOpenChange,
  } = useHoverPopover();

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
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverAnchor asChild>
          <Button
            ref={anchorRef}
            variant="ghost"
            size="icon"
            aria-label={t("profile.switch")}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="h-11 w-11 shrink-0 rounded-full"
            {...triggerProps}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback
                className="text-xs font-bold text-white"
                style={{ backgroundColor: profile.avatarColor }}
              >
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </PopoverAnchor>

        <PopoverContent
          ref={contentRef}
          side="bottom"
          align="end"
          sideOffset={8}
          aria-label={t("profile.switch")}
          {...contentProps}
          className="max-h-[var(--radix-popover-content-available-height)] w-64 overflow-y-auto p-2"
        >
          <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
            {t("profile.change")}
          </div>

          {isLoading && (
            <div className="flex flex-col gap-2 p-2">
              <Skeleton className="h-12 rounded-md" />
              <Skeleton className="h-12 rounded-md" />
            </div>
          )}

          {isError && (
            <MenuRow
              icon={RefreshCw}
              label={t("profile.retry")}
              onClick={() => void refetch()}
            />
          )}

          <div className="grid gap-1">
            {candidates.map((candidate) => {
              const isCurrent = candidate.id === profile.id;
              return (
                <div
                  key={candidate.id}
                  className={
                    isCurrent
                      ? "group flex items-center gap-1 rounded-md"
                      : "group hover:bg-accent flex items-center gap-1 rounded-md transition-colors"
                  }
                >
                  <button
                    type="button"
                    disabled={isCurrent}
                    aria-current={isCurrent ? "true" : undefined}
                    data-popover-initial-focus={isCurrent ? undefined : ""}
                    onClick={() => {
                      close();
                      setSwitchTarget(candidate);
                    }}
                    className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left outline-none focus-visible:ring-[3px] disabled:cursor-default disabled:opacity-100"
                  >
                    <Avatar className="h-8 w-8" aria-hidden="true">
                      <AvatarFallback
                        className="text-xs font-bold text-white"
                        style={{ backgroundColor: candidate.avatarColor }}
                      >
                        {getInitials(candidate.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {candidate.name}
                    </span>
                  </button>

                  {isCurrent && (
                    <Check
                      className="text-primary size-4 shrink-0"
                      aria-hidden="true"
                    />
                  )}

                  {isAdmin && (
                    <Button
                      type="button"
                      variant="bare"
                      size="icon-sm"
                      aria-label={`${t("profile.editTitle")}: ${candidate.name}`}
                      onClick={() => {
                        close();
                        handleEdit(candidate);
                      }}
                      className="mr-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Pencil className="opacity-60 hover:opacity-100" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {isAdmin && (
            <>
              <MenuSeparator />
              <MenuRow
                icon={Plus}
                label={t("profile.addProfile")}
                onClick={() => {
                  close();
                  setCreateOpen(true);
                }}
              />
            </>
          )}

          <MenuSeparator />
          <div className="grid gap-1">
            <MenuRow
              icon={KeyRound}
              label={t("auth.changePassword")}
              onClick={() => {
                close();
                setPasswordOpen(true);
              }}
            />
            <MenuRow
              icon={LogOut}
              label={t("auth.logout")}
              onClick={() => {
                close();
                void logout();
              }}
            />
          </div>
        </PopoverContent>
      </Popover>

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
