import { useTranslation } from "react-i18next";
import { AVATAR_COLORS, getInitials } from "@/lib/selectedProfile";
import { Label } from "@/components/ui/label";

type AvatarColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  previewName?: string;
};

export function AvatarColorPicker({
  value,
  onChange,
  previewName,
}: AvatarColorPickerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label className="text-muted-foreground text-xs font-normal">
          {t("profile.color")}
        </Label>
        {previewName?.trim() && (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: value }}
          >
            {getInitials(previewName.trim())}
          </span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label={t("profile.color")}
        className="flex flex-wrap gap-2"
      >
        {AVATAR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={color}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={`h-8 w-8 rounded-full transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${value === color ? "ring-primary ring-2 ring-offset-2" : "hover:scale-105"}`}
          />
        ))}
      </div>
    </div>
  );
}
