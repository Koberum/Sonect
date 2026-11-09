import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { THEME_TEMPLATES, isThemeTemplate, type ThemeTemplate } from "@/themes";

function TemplatePreview({
  template,
  dark = false,
}: {
  template: ThemeTemplate;
  dark?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      data-theme={template}
      className={cn(
        "bg-background flex h-24 flex-col gap-1.5 p-2",
        dark && "dark",
      )}
    >
      <span className="flex items-center gap-1">
        <span className="bg-primary size-1.5 rounded-full" />
        <span className="bg-muted-foreground/40 h-1 w-6 rounded-full" />
        <span className="bg-muted ml-auto h-1 w-3 rounded-full" />
      </span>
      <span className="flex min-h-0 flex-1 gap-1.5">
        <span className="bg-sidebar w-1/4 rounded-md" />
        <span className="border-border bg-card flex flex-1 flex-col justify-between rounded-md border p-1.5">
          <span className="flex flex-col gap-1">
            <span className="bg-muted-foreground/30 h-1 w-3/4 rounded-full" />
            <span className="bg-muted-foreground/20 h-1 w-1/2 rounded-full" />
          </span>
          <span className="bg-primary h-2 w-2/3 rounded-full" />
        </span>
      </span>
    </span>
  );
}

export function ThemeTemplatePicker() {
  const { t } = useTranslation();
  const { template, setTemplate } = useTheme();

  return (
    <Field>
      <FieldLabel>{t("settings.appearance.template")}</FieldLabel>
      <RadioGroup
        value={template}
        onValueChange={(value) => {
          if (isThemeTemplate(value)) setTemplate(value);
        }}
        className="grid gap-4 sm:grid-cols-3"
      >
        {THEME_TEMPLATES.map((item) => (
          <div key={item.id} className="relative">
            <RadioGroupItem
              value={item.id}
              aria-label={t(item.nameKey)}
              className="peer absolute inset-0 z-10 aspect-auto size-full cursor-pointer opacity-0"
            />
            <span className="border-border bg-card peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-primary/30 block rounded-xl border p-2 transition-shadow peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-data-[state=checked]:ring-2">
              <span className="border-border grid grid-cols-2 overflow-hidden rounded-lg border">
                <TemplatePreview template={item.id} />
                <TemplatePreview template={item.id} dark />
              </span>
              <span className="mt-2 flex items-start justify-between gap-2 px-1 pb-1">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {t(item.nameKey)}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {t(item.descriptionKey)}
                  </span>
                </span>
              </span>
            </span>
            <Check
              aria-hidden="true"
              className="text-primary pointer-events-none absolute top-3 right-3 size-5 opacity-0 peer-data-[state=checked]:opacity-100"
            />
          </div>
        ))}
      </RadioGroup>
      <FieldDescription>
        {t("settings.appearance.templateDescription")}
      </FieldDescription>
    </Field>
  );
}
