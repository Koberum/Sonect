import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  getMpdStatus,
  restartMpd,
  resetSetup,
  stopMpd,
} from "@/features/apis/systemApis";
import { HardwareMonitor } from "@/components/hardware-monitor";

export function DebugTab() {
  const { t } = useTranslation();
  const [mpdStatus, setMpdStatus] = useState<{
    running: boolean;
    error?: string;
  } | null>(null);
  const [mpdChecking, setMpdChecking] = useState(false);
  const [restartDialogOpen, setRestartDialogOpen] = useState(false);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const [resetSetupDialogOpen, setResetSetupDialogOpen] = useState(false);
  const [resettingSetup, setResettingSetup] = useState(false);

  const checkMpdStatus = async () => {
    setMpdChecking(true);
    try {
      const status = await getMpdStatus();
      setMpdStatus(status);
    } catch {
      setMpdStatus({
        running: false,
        error: t("settings.debug.checkError", "Failed to check MPD status"),
      });
    } finally {
      setMpdChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.debug.mpdStatus")}</CardTitle>
          <CardDescription>
            {t("settings.debug.mpdStatusDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={checkMpdStatus}
              disabled={mpdChecking}
            >
              {mpdChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mpdChecking
                ? t("settings.debug.checking")
                : t("settings.debug.checkMpd")}
            </Button>
            {mpdStatus && (
              <Badge variant={mpdStatus.running ? "default" : "destructive"}>
                {mpdStatus.running
                  ? t("settings.debug.mpdRunning")
                  : t("settings.debug.mpdStopped")}
                {mpdStatus.error ? ` (${mpdStatus.error})` : ""}
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRestartDialogOpen(true)}
            >
              {t("settings.debug.restartMpd")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStopDialogOpen(true)}
            >
              {t("settings.debug.stopMpd")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.debug.setup")}</CardTitle>
          <CardDescription>
            {t("settings.debug.setupDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setResetSetupDialogOpen(true)}
              disabled={resettingSetup}
            >
              {resettingSetup && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("settings.debug.resetSetup")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.debug.environment")}</CardTitle>
          <CardDescription>
            {t("settings.debug.environmentDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted max-h-32 overflow-auto rounded-md p-3 text-xs">
            {JSON.stringify(
              {
                MODE: import.meta.env.MODE,
                DEV: import.meta.env.DEV,
                PROD: import.meta.env.PROD,
                VITE_DEBUG: import.meta.env.VITE_DEBUG,
              },
              null,
              2,
            )}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("settings.debug.hardware.cpu")} &{" "}
            {t("settings.debug.hardware.ram")}
          </CardTitle>
          <CardDescription>
            {t("settings.debug.hardware.loading")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HardwareMonitor />
        </CardContent>
      </Card>

      <AlertDialog open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.debug.restartConfirmTitle", "Restart MPD?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "settings.debug.restartConfirm",
                "This will restart MPD and interrupt playback. Continue?",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const result = await restartMpd();
                toast[result.success ? "success" : "warning"](
                  result.success
                    ? t("settings.debug.mpdRestarted")
                    : (result.warning ?? ""),
                );
              }}
            >
              {t("settings.debug.restartMpd")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={stopDialogOpen} onOpenChange={setStopDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.debug.stopConfirmTitle", "Stop MPD?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.debug.stopConfirm", "This will stop MPD. Continue?")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const result = await stopMpd();
                toast[result.success ? "success" : "warning"](
                  result.success
                    ? t("settings.debug.mpdStoppedAction")
                    : (result.warning ?? ""),
                );
              }}
            >
              {t("settings.debug.stopMpd")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={resetSetupDialogOpen}
        onOpenChange={setResetSetupDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.debug.resetSetupConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.debug.resetSetupConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setResettingSetup(true);
                try {
                  await resetSetup();
                  setResetSetupDialogOpen(false);
                  toast.success(t("settings.debug.setupResetted"));
                  window.location.reload();
                } catch {
                  toast.error(t("settings.debug.resetSetupError"));
                } finally {
                  setResettingSetup(false);
                }
              }}
            >
              {t("settings.debug.resetSetup")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
