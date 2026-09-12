import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  SelectableRow,
  SelectableRowDescription,
  SelectableRowTitle,
} from "@/components/ui/selectable-row";
import {
  WizardStep,
  WizardStepActions,
  WizardStepContent,
  WizardStepDescription,
  WizardStepHeader,
  WizardStepTitle,
} from "@/components/ui/wizard-step";
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

  useEffect(() => {
    const fetch = async () => {
      try {
        const [devicesData, audioStatus] = await Promise.all([
          getAudioDevices(),
          getAudioStatus(),
        ]);
        setDevices(devicesData);
        if (audioStatus) {
          setCurrentCard(audioStatus.card);
          const matched = devicesData.find((d) => d.card === audioStatus.card);
          if (matched) setSelected(matched.card);
        }
      } catch {
        toast.error(t("settings.audio.loadError"));
      } finally {
        setFetching(false);
      }
    };
    fetch();
  }, [t]);

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

      <WizardStepContent>
        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            {t("settings.audio.noDevices")}
          </p>
        ) : (
          devices.map((device, index) => (
            <SelectableRow key={index} asChild>
              <label>
                <input
                  type="radio"
                  name="wizard-audio"
                  value={device.card}
                  checked={selected === device.card}
                  onChange={() => setSelected(device.card)}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <SelectableRowTitle>
                    {device.description || device.name}
                  </SelectableRowTitle>
                  <SelectableRowDescription>
                    {device.card}
                  </SelectableRowDescription>
                </div>
                <div className="flex items-center gap-2">
                  {currentCard === device.card && (
                    <Badge className="border-transparent bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      {t("settings.audio.currentlyActive")}
                    </Badge>
                  )}
                  {device.usb && (
                    <Badge className="border-transparent bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      {t("settings.audio.usbDac")}
                    </Badge>
                  )}
                </div>
              </label>
            </SelectableRow>
          ))
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
