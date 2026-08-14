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
import { useTheme, type Theme } from "@/components/theme-provider";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
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
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <div className="mt-8 mb-8 space-y-2">
        <img
          src={logoSrc}
          alt={t("common.appName", "Sonect")}
          className="mx-auto h-15 w-auto"
        />
        <p className="text-muted-foreground max-w-sm text-sm">
          {t(
            "setup.welcome.description",
            "Welcome to Sonect, your self-hosted music streamer.",
          )}
        </p>
      </div>

      <div className="w-64 space-y-4">
        <div className="space-y-2">
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
        </div>

        <div className="space-y-2">
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
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={onNext} size="lg">
          {t("setup.welcome.getStarted", "Get Started")}
        </Button>
      </div>
    </div>
  );
}
