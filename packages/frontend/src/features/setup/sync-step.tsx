import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface SyncStepProps {
  onComplete: () => void;
}

export function SyncStep({ onComplete }: SyncStepProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {t("setup.sync.title", "Library Sync")}
        </h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          {t(
            "setup.sync.description",
            "Your music library is ready to scan. Sonect will sync your music from MPD. You can trigger a full sync at any time.",
          )}
        </p>
      </div>

      <div className="flex gap-3">
        <Button onClick={onComplete} size="lg">
          {t("setup.sync.finish", "Finish Setup")}
        </Button>
      </div>
    </div>
  );
}
