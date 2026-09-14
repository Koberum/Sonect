import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/features/profiles/profile-context";
import { profileQueries } from "@/features/profiles/queries";
import { ProfilePicker } from "@/features/profiles/profile-picker";
import { toSelectedProfile } from "@/lib/selectedProfile";
import { Button } from "@/components/ui/button";

export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { profile, selectProfile } = useProfile();
  const {
    data: profiles,
    isLoading,
    isError,
    refetch,
  } = useQuery(profileQueries.list());

  useEffect(() => {
    if (profiles && profiles.length === 1) {
      const only = profiles[0];
      if (!profile || profile.id !== only.id) {
        selectProfile(toSelectedProfile(only));
      }
    }
  }, [profiles, profile, selectProfile]);

  if (isError) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-4">
        <p role="alert" className="text-center text-sm">
          {t("profile.errors.load")}
        </p>
        <Button type="button" onClick={() => void refetch()}>
          {t("profile.retry")}
        </Button>
      </div>
    );
  }

  if (isLoading || !profiles) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <p role="status" className="text-sm">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  if (profile && profiles.some((c) => c.id === profile.id)) {
    return <>{children}</>;
  }

  if (profiles.length === 1) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <p role="status" className="text-sm">
          {t("common.loading")}
        </p>
      </div>
    );
  }

  return <ProfilePicker mode="page" />;
}
