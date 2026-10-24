import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  WizardStep,
  WizardStepActions,
  WizardStepContent,
  WizardStepDescription,
  WizardStepField,
  WizardStepHeader,
  WizardStepTitle,
} from "@/components/ui/wizard-step";
import { useTheme, type Theme } from "@/components/theme-provider";
import { useAuth } from "@/features/auth/auth-context";

export function AdminStep({ onDone }: { onDone: () => void }) {
  const { t, i18n } = useTranslation();
  const { bootstrap } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const currentLanguage = i18n.language.split("-")[0];
  const canSubmit =
    name.trim().length > 0 &&
    password.length > 0 &&
    confirm.length > 0 &&
    !pending;

  const handleSubmit = async (): Promise<void> => {
    if (pending) return;
    if (!name.trim()) return;
    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await bootstrap({ name: name.trim(), password });
      onDone();
    } catch {
      setError(t("auth.bootstrapError"));
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <WizardStep>
        <WizardStepHeader>
          <WizardStepTitle>{t("auth.bootstrapTitle")}</WizardStepTitle>
          <WizardStepDescription className="max-w-sm">
            {t("auth.bootstrapDescription")}
          </WizardStepDescription>
        </WizardStepHeader>

        <WizardStepContent>
          <WizardStepField>
            <Label htmlFor="admin-name">{t("auth.bootstrapName")}</Label>
            <Input
              id="admin-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              autoFocus
              autoComplete="username"
              maxLength={50}
            />
          </WizardStepField>

          <WizardStepField>
            <Label htmlFor="admin-password">
              {t("auth.bootstrapPassword")}
            </Label>
            <Input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              autoComplete="new-password"
            />
          </WizardStepField>

          <WizardStepField>
            <Label htmlFor="admin-confirm">{t("auth.bootstrapConfirm")}</Label>
            <Input
              id="admin-confirm"
              type="password"
              value={confirm}
              onChange={(event) => {
                setConfirm(event.target.value);
                setError(null);
              }}
              autoComplete="new-password"
            />
          </WizardStepField>

          <WizardStepField>
            <label
              htmlFor="admin-language"
              className="text-muted-foreground block text-sm font-medium"
            >
              {t("setup.welcome.language", "Language")}
            </label>

            <Select
              value={currentLanguage}
              onValueChange={(v) => {
                i18n.changeLanguage(v);
                localStorage.setItem("language", v);
              }}
            >
              <SelectTrigger id="admin-language">
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

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </WizardStepContent>

        <WizardStepActions>
          <div className="flex-1" />
          <Button type="submit" size="lg" disabled={!canSubmit}>
            {pending && <Loader2 className="animate-spin" />}
            {pending ? t("auth.bootstrapCreating") : t("auth.bootstrapSubmit")}
          </Button>
        </WizardStepActions>
      </WizardStep>
    </form>
  );
}
