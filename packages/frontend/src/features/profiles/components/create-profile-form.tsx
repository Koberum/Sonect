import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Profile, ProfileRole } from "@repo/types";
import { AVATAR_COLORS } from "@/lib/avatar";
import { profileMutations } from "../queries";
import { AvatarColorPicker } from "./avatar-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<ProfileRole>("user");
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation(profileMutations.create());

  const canSubmit =
    name.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length > 0 &&
    !createMut.isPending;

  const handleCreate = async (): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed || createMut.isPending) return;
    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }
    setError(null);
    try {
      const created = await createMut.mutateAsync({
        name: trimmed,
        avatarColor: color,
        password,
        role,
      });
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create-profile-password">{t("auth.password")}</Label>
        <Input
          id="create-profile-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create-profile-confirm">
          {t("auth.confirmPassword")}
        </Label>
        <Input
          id="create-profile-confirm"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="create-profile-role">{t("auth.role")}</Label>
        <Select
          value={role}
          onValueChange={(value) => setRole(value as ProfileRole)}
        >
          <SelectTrigger id="create-profile-role" className="w-full">
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

      <div className="flex gap-2">
        <Button
          type="button"
          disabled={!canSubmit}
          onClick={() => void handleCreate()}
          className="flex-1"
        >
          {createMut.isPending && <Loader2 className="animate-spin" />}
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
