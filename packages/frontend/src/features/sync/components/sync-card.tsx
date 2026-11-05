import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePlaybackContext } from "@/components/playback-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import { scanLibrary } from "@/features/catalog/api";
import { SyncProgressView } from "./sync-progress-view";

export function SyncCard() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { syncProgress, syncError } = usePlaybackContext();

  const scanMutation = useMutation({
    mutationFn: () => scanLibrary(),
  });

  if (!isAdmin) return null;

  const running = scanMutation.isPending || syncProgress !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("sync.title")}</CardTitle>
        <CardDescription>{t("sync.cardDescription")}</CardDescription>
        <CardAction>
          <Button onClick={() => scanMutation.mutate()} disabled={running}>
            {running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {running ? t("sync.syncing") : t("sync.syncNow")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {syncProgress ? (
          <SyncProgressView progress={syncProgress} />
        ) : scanMutation.isPending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="text-primary size-4 animate-spin" />
            {t("sync.preparing")}
          </p>
        ) : syncError ? (
          <div
            role="alert"
            className="border-destructive/50 bg-destructive/10 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-destructive text-sm font-medium">
                  {t("sync.failed")}
                </p>
                <p className="text-muted-foreground text-xs break-words">
                  {syncError}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => scanMutation.mutate()}
              disabled={running}
            >
              <RefreshCw />
              {t("sync.retry")}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("sync.idle")}</p>
        )}
      </CardContent>
    </Card>
  );
}
