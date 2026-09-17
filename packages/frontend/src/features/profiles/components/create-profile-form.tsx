import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import type { Profile } from "@repo/types";
import { AVATAR_COLORS, toSelectedProfile } from "@/lib/selectedProfile";
import { useProfile } from "../profile-context";
import { profileMutations } from "../queries";
import { AvatarColorPicker } from "./avatar-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CreateProfileFormProps = {
  onCreated?: (profile: Profile) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
};

export function CreateProfileForm({
  onCreated,
  onCancel,
  autoFocus = true,
}: CreateProfileFormProps) {
  const { t } = useTranslation();
  const { selectProfile } = useProfile();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation(profileMutations.create());

  const handleCreate = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed || createMut.isPending) return;
    setError(null);
    try {
      const created = await createMut.mutateAsync({
        name: trimmed,
        avatarColor: color,
      });
      selectProfile(toSelectedProfile(created));
      onCreated?.(created);
    } catch {
      setError(t("profile.errors.create"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create-profile-name">
          {t("profile.namePlaceholder")}
        </Label>
        <Input
          id="create-profile-name"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCreate();
            if (e.key === "Escape") onCancel?.();
          }}
          placeholder={t("profile.namePlaceholder")}
          autoFocus={autoFocus}
        />
      </div>

      <AvatarColorPicker value={color} onChange={setColor} previewName={name} />

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          disabled={!name.trim() || createMut.isPending}
          onClick={() => void handleCreate()}
          className="flex-1"
        >
          {t("profile.create")}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={createMut.isPending}
            className="flex-1"
          >
            {t("common.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
}
