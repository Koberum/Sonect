import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Profile, ProfileRole } from "@repo/types";
import { AVATAR_COLORS } from "@/lib/avatar";
import { profileMutations } from "../queries";
import { ProfileFields } from "./profile-fields";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { usePasswordValidation } from "@/features/auth/use-password-validation";

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
  const { validateNewPassword } = usePasswordValidation();
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
    const validationError = validateNewPassword(password, confirmPassword);
    if (validationError) {
      setError(validationError);
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
      <ProfileFields
        idPrefix="create-profile"
        name={name}
        onNameChange={setName}
        color={color}
        onColorChange={setColor}
        role={role}
        onRoleChange={setRole}
        autoFocus={autoFocus}
        onNameKeyDown={(event) => {
          if (event.key === "Enter") void handleCreate();
          if (event.key === "Escape") onCancel?.();
        }}
      />

      <PasswordField
        id="create-profile-password"
        label={t("auth.password")}
        value={password}
        onChange={setPassword}
      />

      <PasswordField
        id="create-profile-confirm"
        label={t("auth.confirmPassword")}
        value={confirmPassword}
        onChange={setConfirmPassword}
      />

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
