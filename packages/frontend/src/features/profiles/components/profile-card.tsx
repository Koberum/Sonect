import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { Profile } from "@repo/types";
import { getInitials } from "@/lib/selectedProfile";
import { profileMutations } from "../queries";
import { AvatarColorPicker } from "./avatar-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

type ProfileCardProps = {
  profile: Profile;
  selected: boolean;
  canDelete: boolean;
  onSelect: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
};

export function ProfileCard({
  profile,
  selected,
  canDelete,
  onSelect,
  onDelete,
}: ProfileCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [color, setColor] = useState(profile.avatarColor);
  const [error, setError] = useState<string | null>(null);

  const updateMut = useMutation(profileMutations.update());

  const handleSave = async (): Promise<void> => {
    const trimmed = name.trim();
    const data: { name?: string; avatarColor?: string } = {};
    if (trimmed && trimmed !== profile.name) data.name = trimmed;
    if (color !== profile.avatarColor) data.avatarColor = color;
    if (Object.keys(data).length === 0) {
      setEditing(false);
      return;
    }
    setError(null);
    try {
      await updateMut.mutateAsync({ id: profile.id, ...data });
      setEditing(false);
    } catch {
      setError(t("profile.errors.update"));
    }
  };

  const handleCancel = (): void => {
    setName(profile.name);
    setColor(profile.avatarColor);
    setError(null);
    setEditing(false);
  };

  if (editing) {
    return (
      <Card className={`py-4 ${selected ? "border-primary" : ""}`}>
        <CardContent className="flex flex-col gap-3 px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`rename-${profile.id}`}>
              {t("profile.namePlaceholder")}
            </Label>
            <Input
              id={`rename-${profile.id}`}
              value={name}
              maxLength={50}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("profile.namePlaceholder")}
              autoFocus
            />
          </div>
          <AvatarColorPicker
            value={color}
            onChange={setColor}
            previewName={name}
          />
          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="gap-2 px-4 pt-0">
          <Button
            type="button"
            size="sm"
            disabled={updateMut.isPending}
            onClick={() => void handleSave()}
            className="flex-1"
          >
            {t("profile.save")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCancel}
            className="flex-1"
          >
            {t("common.cancel")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card
      className={`py-4 transition-colors ${selected ? "border-primary" : ""}`}
    >
      <CardContent className="flex flex-col items-center gap-2 px-4 pt-2">
        <button
          type="button"
          onClick={() => onSelect(profile)}
          aria-label={`${t("profile.select")}: ${profile.name}`}
          aria-pressed={selected}
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
      <CardFooter className="justify-center gap-1 px-4 pt-0">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`${t("profile.rename")}: ${profile.name}`}
          onClick={() => {
            setName(profile.name);
            setColor(profile.avatarColor);
            setEditing(true);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={!canDelete}
          aria-label={`${t("profile.delete")}: ${profile.name}`}
          onClick={() => onDelete(profile)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
