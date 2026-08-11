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
import { toast } from "sonner";
import {
  getAudioDevices,
  configureAudio,
  getAudioStatus,
  type AudioDevice,
} from "@/features/apis/systemApis";

interface AudioStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function AudioStep({ onNext, onSkip }: AudioStepProps) {
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
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">{t("settings.audio.title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("settings.audio.description")}
        </p>
      </div>

      {fetching ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : devices.length === 0 ? (
        <p className="text-muted-foreground text-center text-sm">
          {t("settings.audio.noDevices")}
        </p>
      ) : (
        <div className="space-y-2">
          {devices.map((device) => (
            <SelectableRow key={device.card} asChild>
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
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip}>
          {t("common.skip", "Skip")}
        </Button>
        <Button onClick={handleApply} disabled={!selected || loading}>
          {loading
            ? t("settings.audio.applying")
            : t("setup.audio.applyAndContinue", "Apply & Continue")}
        </Button>
      </div>
    </div>
  );
}
