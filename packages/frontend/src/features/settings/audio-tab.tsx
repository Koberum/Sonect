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
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { systemQueries, systemMutations } from "@/features/system/queries";

export function AudioTab() {
  const { t } = useTranslation();
  const { data: devices = [], isPending: fetching } = useQuery(
    systemQueries.audioDevices(),
  );
  const { data: audioStatus } = useQuery(systemQueries.audioStatus());
  const [selected, setSelected] = useState<string>("");
  const configureMut = useMutation(systemMutations.configureAudio());

  useEffect(() => {
    if (audioStatus) {
      const matched = devices.find((d) => d.card === audioStatus.card);
      if (matched) setSelected(matched.card);
    }
  }, [audioStatus, devices]);

  const handleApply = async () => {
    if (!selected) return;
    try {
      const device = devices.find((d) => d.card === selected);
      const result = await configureMut.mutateAsync({
        card: selected,
        name: device?.name ?? "Audio Output",
      });
      if (result.success) {
        toast.success(t("settings.audio.configured"));
        if (result.warning) toast.warning(result.warning);
      } else {
        toast.error(result.warning ?? t("settings.audio.configureError"));
      }
    } catch {
      toast.error(t("settings.audio.configureError"));
    }
  };

  const loading = configureMut.isPending;

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
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder={t("settings.audio.noDevices")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {devices.map((device) => (
                <SelectItem key={device.card} value={device.card}>
                  {device.description || device.name} - {device.card}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button onClick={handleApply} disabled={!selected || loading}>
          {loading ? t("settings.audio.applying") : t("settings.audio.apply")}
        </Button>
      </CardContent>
    </Card>
  );
}
