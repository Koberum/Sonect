import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { playerMutations, playerQueries } from "@/features/player/queries";

export function PlaybackTab() {
  const { t } = useTranslation();
  const settingsQuery = useQuery(playerQueries.settings());
  const saveMut = useMutation(playerMutations.setSettings());
  const [crossfade, setCrossfade] = useState(0);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settingsQuery.data && !dirty) {
      setCrossfade(settingsQuery.data.crossfadeSeconds);
    }
  }, [settingsQuery.data, dirty]);

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync(crossfade);
      setDirty(false);
      toast.success(t("settings.playback.saved"));
    } catch {
      toast.error(t("settings.playback.saveError"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.playback.title")}</CardTitle>
        <CardDescription>{t("settings.playback.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {settingsQuery.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : settingsQuery.isError ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <p>{t("settings.playback.loadError")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => settingsQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label>{t("settings.playback.crossfadeLabel")}</Label>
                <span className="text-muted-foreground text-sm tabular-nums">
                  {t("settings.playback.seconds", { seconds: crossfade })}
                </span>
              </div>
              <Slider
                min={0}
                max={30}
                step={1}
                value={[crossfade]}
                aria-label={t("settings.playback.crossfadeLabel")}
                onValueChange={(value) => {
                  setDirty(true);
                  setCrossfade(value[0] ?? 0);
                }}
              />
              <p className="text-muted-foreground text-xs leading-5">
                {t("settings.playback.hint")}
              </p>
              <p className="text-muted-foreground text-xs leading-5">
                {t("settings.playback.mpdHint")}
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!dirty || saveMut.isPending}
              >
                {saveMut.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {saveMut.isPending
                  ? t("settings.playback.saving")
                  : t("settings.playback.save")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
