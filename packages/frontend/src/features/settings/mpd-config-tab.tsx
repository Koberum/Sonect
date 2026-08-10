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
import { getMpdConfig, updateMpdConfig } from "@/features/apis/systemApis";

export function MpdConfigTab() {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    getMpdConfig()
      .then((cfg) => {
        setContent(cfg.content);
        setOriginalContent(cfg.content);
      })
      .catch(() => toast.error(t("settings.config.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  const handleSave = async () => {
    setSaving(true);
    setSaveDialogOpen(false);
    try {
      const result = await updateMpdConfig(content);
      if (result.success) {
        toast.success(result.warning ?? t("settings.config.saved"));
        setOriginalContent(content);
      }
    } catch {
      toast.error(t("settings.config.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = content !== originalContent;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center pt-6">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.config.title")}</CardTitle>
        <CardDescription>{t("settings.config.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="bg-background h-[60vh] w-full rounded-md border p-4 font-mono text-sm"
          spellCheck={false}
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setSaveDialogOpen(true)}
            disabled={!hasChanges || saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving
              ? t("settings.config.saving")
              : t("settings.config.saveRestart")}
          </Button>
          {hasChanges && (
            <Button
              variant="outline"
              onClick={() => setContent(originalContent)}
            >
              {t("settings.config.reset")}
            </Button>
          )}
        </div>
      </CardContent>

      <AlertDialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.config.restartConfirmTitle", "Save & Restart MPD?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "settings.config.restartConfirm",
                "Saving will restart MPD and interrupt playback. Continue?",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleSave}>
              {t("settings.config.saveRestart")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
