import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { VolumeX } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WizardStep,
  WizardStepActions,
  WizardStepContent,
  WizardStepDescription,
  WizardStepHeader,
  WizardStepTitle,
} from "@/components/ui/wizard-step";
import { AudioDeviceList } from "@/features/settings/audio-device-list";
import { toast } from "sonner";
import {
  getAudioDevices,
  configureAudio,
  getAudioStatus,
  type AudioDevice,
} from "@/features/system/api";

interface AudioStepProps {
  onNext: () => void;
}

export function AudioStep({ onNext }: AudioStepProps) {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [currentCard, setCurrentCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    setLoadError(false);
    try {
      const [devicesData, audioStatus] = await Promise.all([
        getAudioDevices(),
        getAudioStatus(),
      ]);
      setDevices(devicesData);
      setCurrentCard(audioStatus?.card ?? null);
      const matched = devicesData.find((d) => d.card === audioStatus?.card);
      setSelected(matched?.card ?? "");
    } catch {
      setLoadError(true);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApply = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const device = devices.find((d) => d.card === selected);
      const result = await configureAudio({
        card: selected,
        name: device?.name ?? "Audio Output",
      });
      if (result.success) {
        toast.success(t("settings.audio.configured"));
        onNext();
      } else {
        toast.error(result.warning ?? t("settings.audio.configureError"));
      }
    } catch {
      toast.error(t("settings.audio.configureError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <WizardStep>
      <WizardStepHeader>
        <WizardStepTitle>{t("settings.audio.title")}</WizardStepTitle>
        <WizardStepDescription>
          {t("settings.audio.description")}
        </WizardStepDescription>
      </WizardStepHeader>

      <WizardStepContent className="flex flex-col gap-4">
        {fetching ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : loadError ? (
          <Alert
            variant="destructive"
            className="flex flex-wrap items-center justify-between gap-3 text-left"
          >
            <AlertDescription>{t("settings.audio.loadError")}</AlertDescription>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              {t("common.retry")}
            </Button>
          </Alert>
        ) : devices.length === 0 ? (
          <EmptyState
            icon={VolumeX}
            title={t("settings.audio.noDevices")}
            className="py-6"
          />
        ) : (
          <div className="text-left">
            <AudioDeviceList
              devices={devices}
              value={selected}
              onValueChange={setSelected}
              currentCard={currentCard}
            />
          </div>
        )}
      </WizardStepContent>

      <WizardStepActions>
        <Button onClick={handleApply} disabled={!selected || loading}>
          {loading
            ? t("settings.audio.applying")
            : t("setup.audio.applyAndContinue", "Apply & Continue")}
        </Button>
      </WizardStepActions>
    </WizardStep>
  );
}
