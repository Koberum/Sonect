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
import { Separator } from "@/components/ui/separator";
import { AudioDevicePicker } from "./audio-device-picker";
import { useAudioOutput } from "./use-audio-output";

export function AudioTab() {
  const { t } = useTranslation();
  const audio = useAudioOutput();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.audio.title")}</CardTitle>
        <CardDescription>{t("settings.audio.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AudioDevicePicker
          devices={audio.devices}
          selected={audio.selected}
          onSelectedChange={audio.select}
          currentCard={audio.audioStatus?.card}
          isPending={audio.isPending}
          isError={audio.isError}
          onRetry={() => void audio.refetch()}
        />

        <Separator />

        <div className="flex justify-end">
          <Button
            onClick={() => void audio.apply()}
            disabled={!audio.selected || audio.loading}
            className="w-full sm:w-auto"
          >
            {audio.loading ? <Loader2 className="animate-spin" /> : null}
            {audio.loading
              ? t("settings.audio.applying")
              : t("settings.audio.apply")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
