import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme, type Theme } from "@/components/theme-provider";

export function AppearanceTab() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const currentLanguage = i18n.language.split("-")[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.tabs.appearance")}</CardTitle>
        <CardDescription>
          {t("settings.appearance.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel>{t("settings.appearance.theme")}</FieldLabel>
            <ToggleGroup
              type="single"
              variant="outline"
              value={theme}
              onValueChange={(value) => {
                if (value) setTheme(value as Theme);
              }}
              className="w-full sm:w-auto"
            >
              <ToggleGroupItem
                value="light"
                aria-label={t("theme.light")}
                className="flex-1 gap-2 sm:flex-none"
              >
                <Sun />
                <span>{t("theme.light")}</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="dark"
                aria-label={t("theme.dark")}
                className="flex-1 gap-2 sm:flex-none"
              >
                <Moon />
                <span>{t("theme.dark")}</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="system"
                aria-label={t("theme.system")}
                className="flex-1 gap-2 sm:flex-none"
              >
                <Monitor />
                <span>{t("theme.system")}</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <FieldDescription>
              {t("settings.appearance.themeDescription")}
            </FieldDescription>
          </Field>

          <FieldSeparator />

          <Field>
            <FieldLabel htmlFor="appearance-language">
              {t("settings.appearance.language")}
            </FieldLabel>
            <Select
              value={currentLanguage}
              onValueChange={(value) => {
                i18n.changeLanguage(value);
                localStorage.setItem("language", value);
              }}
            >
              <SelectTrigger
                id="appearance-language"
                className="w-full sm:w-56"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("language.en")}</SelectItem>
                <SelectItem value="es">{t("language.es")}</SelectItem>
                <SelectItem value="it">{t("language.it")}</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              {t("settings.appearance.languageDescription")}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
