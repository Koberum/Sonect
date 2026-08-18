import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  getAudioDevices,
  configureAudio,
  getAudioStatus,
  type AudioDevice,
} from "@/features/apis/systemApis";

export function AudioTab() {
  const { t } = useTranslation();
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selected, setSelected] = useState<string>("");
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
        if (result.warning) {
          toast.warning(result.warning);
        }
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
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.audio.title")}</CardTitle>
        <CardDescription>{t("settings.audio.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {t("settings.audio.noDevices")}
          </p>
        ) : null}
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder={t("settings.audio.noDevices")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{t("settings.audio.devices")}</SelectLabel>

              {devices.map((device) => (
                <SelectItem key={device.card} value={device.card}>
                  {device.description || device.name} - {device.card}
                </SelectItem>
              ))}
            </SelectGroup>
            {/* {currentCard === device.card && (
              <Badge className="border-transparent bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                {t("settings.audio.currentlyActive")}
              </Badge>
            )}
            {device.usb && (
              <Badge className="border-transparent bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                {t("settings.audio.usbDac")}
              </Badge>
            )} */}
          </SelectContent>
        </Select>

        <Button onClick={handleApply} disabled={!selected || loading}>
          {loading ? t("settings.audio.applying") : t("settings.audio.apply")}
        </Button>
      </CardContent>
    </Card>
  );
}
