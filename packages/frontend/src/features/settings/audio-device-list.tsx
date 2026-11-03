import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { AudioDevice } from "@/features/system/api";

interface AudioDeviceListProps {
  devices: AudioDevice[];
  value: string;
  onValueChange: (card: string) => void;
  currentCard?: string | null;
}

export function AudioDeviceList({
  devices,
  value,
  onValueChange,
  currentCard,
}: AudioDeviceListProps) {
  const { t } = useTranslation();

  return (
    <RadioGroup value={value} onValueChange={onValueChange} className="gap-2">
      {devices.map((device) => (
        <FieldLabel
          key={device.card}
          htmlFor={`audio-device-${device.card}`}
          className="w-full cursor-pointer has-[>[data-slot=field]]:rounded-lg [&>[data-slot=field]]:p-3"
        >
          <Field orientation="horizontal" className="items-center gap-3">
            <FieldContent className="min-w-0">
              <FieldTitle className="max-w-full truncate">
                {device.description || device.name}
              </FieldTitle>
              <FieldDescription className="font-mono text-xs">
                {device.card}
              </FieldDescription>
              {(currentCard === device.card || device.usb) && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {currentCard === device.card && (
                    <Badge variant="secondary">
                      {t("settings.audio.currentlyActive")}
                    </Badge>
                  )}
                  {device.usb && (
                    <Badge variant="outline">
                      {t("settings.audio.usbDac")}
                    </Badge>
                  )}
                </div>
              )}
            </FieldContent>
            <RadioGroupItem
              value={device.card}
              id={`audio-device-${device.card}`}
              className="mt-0.5 shrink-0"
            />
          </Field>
        </FieldLabel>
      ))}
    </RadioGroup>
  );
}
