import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  WizardStep,
  WizardStepActions,
  WizardStepContent,
  WizardStepDescription,
  WizardStepField,
  WizardStepHeader,
} from "@/components/ui/wizard-step";
import { useTheme, type Theme } from "@/components/theme-provider";

interface WelcomeStepProps {
  onNext: () => void;
  onSkipAll?: () => void;
}

export function WelcomeStep({ onNext, onSkipAll }: WelcomeStepProps) {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const currentLanguage = i18n.language.split("-")[0];
  const effectiveTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const logoSrc =
    effectiveTheme === "dark"
      ? "/sonect-logo-dark.svg"
      : "/sonect-logo-light.svg";

  return (
    <WizardStep>
      <WizardStepHeader>
        <img
          src={logoSrc}
          alt={t("common.appName", "Sonect")}
          className="mx-auto h-15 w-auto"
        />
        <WizardStepDescription className="max-w-sm">
          {t(
            "setup.welcome.description",
            "Welcome to Sonect — your self-hosted music streamer.",
          )}
        </WizardStepDescription>
      </WizardStepHeader>

      <WizardStepContent>
        <WizardStepField>
          <label className="text-muted-foreground block text-sm font-medium">
            {t("setup.welcome.language", "Language")}
          </label>
          <Select
            value={currentLanguage}
            onValueChange={(v) => {
              i18n.changeLanguage(v);
              localStorage.setItem("language", v);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("language.en")}</SelectItem>
              <SelectItem value="es">{t("language.es")}</SelectItem>
              <SelectItem value="it">{t("language.it")}</SelectItem>
            </SelectContent>
          </Select>
        </WizardStepField>

        <WizardStepField>
          <label
            htmlFor="setup-theme"
            className="text-muted-foreground block text-sm font-medium"
          >
            {t("setup.welcome.theme", "Theme")}
          </label>
          <Select value={theme} onValueChange={(v) => setTheme(v as Theme)}>
            <SelectTrigger id="setup-theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t("theme.light")}</SelectItem>
              <SelectItem value="dark">{t("theme.dark")}</SelectItem>
              <SelectItem value="system">{t("theme.system")}</SelectItem>
            </SelectContent>
          </Select>
        </WizardStepField>
      </WizardStepContent>

      <WizardStepActions>
        <Button variant="link" onClick={onSkipAll}>
          {t("setup.welcome.skipWizard", "Skip Wizard")}
        </Button>
        <div className="flex-1" />
        <Button onClick={onNext} size="lg">
          {t("setup.welcome.getStarted", "Get Started")}
        </Button>
      </WizardStepActions>
    </WizardStep>
  );
}
