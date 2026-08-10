import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Sonect</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          {t(
            "setup.welcome.description",
            "Welcome to Sonect — your self-hosted music streamer.",
          )}
        </p>
      </div>

      <div className="w-48 space-y-2">
        <label className="text-muted-foreground block text-sm font-medium">
          {t("setup.welcome.language", "Language")}
        </label>
        <Select
          value={i18n.language}
          onValueChange={(v) => i18n.changeLanguage(v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="it">Italiano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onSkip}>
          {t("common.skip", "Skip")}
        </Button>
        <Button onClick={onNext} size="lg">
          {t("setup.welcome.getStarted", "Get Started")}
        </Button>
      </div>
    </div>
  );
}
