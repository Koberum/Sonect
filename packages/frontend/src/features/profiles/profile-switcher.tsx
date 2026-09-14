import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useProfile } from "./profile-context";
import { getInitials } from "@/lib/selectedProfile";
import { ProfilePicker } from "./profile-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ProfileSwitcher() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("profile.switch")}
          className="h-8 w-8 rounded-full p-0"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: profile.avatarColor }}
          >
            {getInitials(profile.name)}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("profile.change")}</DialogTitle>
        </DialogHeader>
        <ProfilePicker mode="modal" onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
