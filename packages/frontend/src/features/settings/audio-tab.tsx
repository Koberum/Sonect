import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, VolumeX } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AudioDeviceList } from "./audio-device-list";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { systemQueries, systemMutations } from "@/features/system/queries";

export function AudioTab() {
  const { t } = useTranslation();
  const devicesQuery = useQuery(systemQueries.audioDevices());
  const { data: devices = [] } = devicesQuery;
  const { data: audioStatus } = useQuery(systemQueries.audioStatus());
  const [selected, setSelected] = useState<string>("");
  const userSelected = useRef(false);
  const configureMut = useMutation(systemMutations.configureAudio());

  useEffect(() => {
    if (userSelected.current || !audioStatus) return;
    const matched = devices.find((d) => d.card === audioStatus.card);
    if (matched) setSelected(matched.card);
  }, [audioStatus, devices]);

  useEffect(() => {
    if (selected && !devices.some((device) => device.card === selected)) {
      userSelected.current = false;
      setSelected("");
    }
  }, [devices, selected]);

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
      <CardContent className="flex flex-col gap-4">
        {devicesQuery.isError ? (
          <Alert
            variant="destructive"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <AlertDescription>{t("settings.audio.loadError")}</AlertDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void devicesQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </Alert>
        ) : devicesQuery.isPending ? (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <EmptyState
            icon={VolumeX}
            title={t("settings.audio.noDevices")}
            className="py-6"
          />
        ) : (
          <AudioDeviceList
            devices={devices}
            value={selected}
            currentCard={audioStatus?.card}
            onValueChange={(value) => {
              userSelected.current = true;
              setSelected(value);
            }}
          />
        )}

        <Separator />

        <div className="flex justify-end">
          <Button
            onClick={handleApply}
            disabled={!selected || loading}
            className="w-full sm:w-auto"
          >
            {loading ? <Loader2 className="animate-spin" /> : null}
            {loading ? t("settings.audio.applying") : t("settings.audio.apply")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
