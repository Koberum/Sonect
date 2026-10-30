import type { PublicProfile } from "@repo/types";
import { useTranslation } from "react-i18next";
import { getInitials } from "@/lib/avatar";
import { Card, CardContent } from "@/components/ui/card";

type ProfileCardProps = {
  profile: PublicProfile;
  onSelect: (profile: PublicProfile) => void;
};

export function ProfileCard({ profile, onSelect }: ProfileCardProps) {
  const { t } = useTranslation();
  return (
    <Card className="hover:border-primary py-4 transition-colors">
      <CardContent className="flex flex-col items-center gap-2 px-4 pt-2">
        <button
          type="button"
          onClick={() => onSelect(profile)}
          aria-label={`${t("profile.select")}: ${profile.name}`}
          className="flex w-full flex-col items-center gap-2"
        >
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {getInitials(profile.name)}
          </span>
          <span className="w-full truncate text-center text-sm font-medium">
            {profile.name}
          </span>
        </button>
      </CardContent>
    </Card>
  );
}
