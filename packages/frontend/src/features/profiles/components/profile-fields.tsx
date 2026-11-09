import { useTranslation } from "react-i18next";
import type { KeyboardEvent } from "react";
import type { ProfileRole } from "@repo/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarColorPicker } from "./avatar-color-picker";

interface ProfileFieldsProps {
  idPrefix: string;
  name: string;
  onNameChange: (name: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  role: ProfileRole;
  onRoleChange: (role: ProfileRole) => void;
  autoFocus?: boolean;
  onNameKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

/** Name, avatar color and role fields shared by profile create and edit. */
export function ProfileFields({
  idPrefix,
  name,
  onNameChange,
  color,
  onColorChange,
  role,
  onRoleChange,
  autoFocus,
  onNameKeyDown,
}: ProfileFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>
          {t("profile.namePlaceholder")}
        </Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          maxLength={50}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={onNameKeyDown}
          placeholder={t("profile.namePlaceholder")}
          autoFocus={autoFocus}
        />
      </div>

      <AvatarColorPicker
        value={color}
        onChange={onColorChange}
        previewName={name}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-role`}>{t("auth.role")}</Label>
        <Select
          value={role}
          onValueChange={(value) => onRoleChange(value as ProfileRole)}
        >
          <SelectTrigger id={`${idPrefix}-role`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">{t("auth.roleUser")}</SelectItem>
            <SelectItem value="admin">{t("auth.roleAdmin")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
