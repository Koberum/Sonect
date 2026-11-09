import { useTranslation } from "react-i18next";
import { VolumeX } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AudioDeviceList } from "./audio-device-list";
import type { AudioDevice } from "@/features/system/api";

interface AudioDevicePickerProps {
  devices: AudioDevice[];
  selected: string;
  onSelectedChange: (card: string) => void;
  currentCard?: string | null;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}

/** Loading/error/empty states around the shared audio device radio list. */
export function AudioDevicePicker({
  devices,
  selected,
  onSelectedChange,
  currentCard,
  isPending,
  isError,
  onRetry,
}: AudioDevicePickerProps) {
  const { t } = useTranslation();

  if (isError) {
    return (
      <Alert
        variant="destructive"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <AlertDescription>{t("settings.audio.loadError")}</AlertDescription>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      </Alert>
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1].map((index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <EmptyState
        icon={VolumeX}
        title={t("settings.audio.noDevices")}
        className="py-6"
      />
    );
  }

  return (
    <AudioDeviceList
      devices={devices}
      value={selected}
      onValueChange={onSelectedChange}
      currentCard={currentCard}
    />
  );
}
