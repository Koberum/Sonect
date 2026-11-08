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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { playerMutations, playerQueries } from "@/features/player/queries";

export function PlaybackTab() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const settingsQuery = useQuery(playerQueries.settings(profileId));
  const saveMut = useMutation(playerMutations.setSettings(profileId));
  const [crossfade, setCrossfade] = useState(0);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settingsQuery.data && !dirty) {
      setCrossfade(settingsQuery.data.crossfadeSeconds);
    }
  }, [settingsQuery.data, dirty]);

  const handleSave = async () => {
    if (!profileId) return;
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
      <CardContent className="flex flex-col gap-4">
        {settingsQuery.isPending ? (
          <FieldGroup className="gap-3">
            <Field className="gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </Field>
          </FieldGroup>
        ) : settingsQuery.isError ? (
          <Alert
            variant="destructive"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <AlertDescription>
              {t("settings.playback.loadError")}
            </AlertDescription>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void settingsQuery.refetch()}
            >
              {t("common.retry")}
            </Button>
          </Alert>
        ) : (
          <>
            <FieldGroup className="gap-4">
              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="crossfade-slider">
                    {t("settings.playback.crossfadeLabel")}
                  </FieldLabel>
                  <Badge variant="secondary" className="tabular-nums">
                    {t("settings.playback.seconds", { seconds: crossfade })}
                  </Badge>
                </div>
                <Slider
                  id="crossfade-slider"
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
                <FieldDescription>
                  <span className="block">{t("settings.playback.hint")}</span>
                  <span className="mt-1 block">
                    {t("settings.playback.outputHint")}
                  </span>
                </FieldDescription>
              </Field>
            </FieldGroup>

            <Separator />

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={!dirty || saveMut.isPending}
                className="w-full sm:w-auto"
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
