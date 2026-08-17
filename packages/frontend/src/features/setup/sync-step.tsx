import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  WizardStep,
  WizardStepActions,
  WizardStepDescription,
  WizardStepHeader,
  WizardStepTitle,
} from "@/components/ui/wizard-step";

interface SyncStepProps {
  onComplete: () => void;
}

export function SyncStep({ onComplete }: SyncStepProps) {
  const { t } = useTranslation();

  return (
    <WizardStep>
      <WizardStepHeader>
        <WizardStepTitle>
          {t("setup.sync.title", "Library Sync")}
        </WizardStepTitle>
        <WizardStepDescription className="max-w-sm">
          {t(
            "setup.sync.description",
            "Your music library is ready to scan. Sonect will sync your music from MPD. You can trigger a full sync at any time.",
          )}
        </WizardStepDescription>
      </WizardStepHeader>

      <WizardStepActions>
        <Button onClick={onComplete} size="lg">
          {t("setup.sync.finish", "Finish Setup")}
        </Button>
      </WizardStepActions>
    </WizardStep>
  );
}
