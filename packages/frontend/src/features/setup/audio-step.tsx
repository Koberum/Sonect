import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  WizardStep,
  WizardStepActions,
  WizardStepContent,
  WizardStepDescription,
  WizardStepHeader,
  WizardStepTitle,
} from "@/components/ui/wizard-step";
import { AudioDevicePicker } from "@/features/settings/audio-device-picker";
import { useAudioOutput } from "@/features/settings/use-audio-output";

interface AudioStepProps {
  onNext: () => void;
}

export function AudioStep({ onNext }: AudioStepProps) {
  const { t } = useTranslation();
  const audio = useAudioOutput({ onConfigured: onNext });

  return (
    <WizardStep>
      <WizardStepHeader>
        <WizardStepTitle>{t("settings.audio.title")}</WizardStepTitle>
        <WizardStepDescription>
          {t("settings.audio.description")}
        </WizardStepDescription>
      </WizardStepHeader>

      <WizardStepContent className="flex flex-col gap-4">
        <div className="text-left">
          <AudioDevicePicker
            devices={audio.devices}
            selected={audio.selected}
            onSelectedChange={audio.select}
            currentCard={audio.audioStatus?.card}
            isPending={audio.isPending}
            isError={audio.isError}
            onRetry={() => void audio.refetch()}
          />
        </div>
      </WizardStepContent>

      <WizardStepActions>
        <Button
          onClick={() => void audio.apply()}
          disabled={!audio.selected || audio.loading}
        >
          {audio.loading
            ? t("settings.audio.applying")
            : t("setup.audio.applyAndContinue", "Apply & Continue")}
        </Button>
      </WizardStepActions>
    </WizardStep>
  );
}
