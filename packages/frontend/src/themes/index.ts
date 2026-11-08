export const THEME_TEMPLATES = [
  {
    id: "sonect",
    nameKey: "themeTemplates.sonect.name",
    descriptionKey: "themeTemplates.sonect.description",
  },
  {
    id: "graphite",
    nameKey: "themeTemplates.graphite.name",
    descriptionKey: "themeTemplates.graphite.description",
  },
  {
    id: "ocean",
    nameKey: "themeTemplates.ocean.name",
    descriptionKey: "themeTemplates.ocean.description",
  },
] as const;

export type ThemeTemplate = (typeof THEME_TEMPLATES)[number]["id"];

export const DEFAULT_THEME_TEMPLATE: ThemeTemplate = "sonect";
export const THEME_TEMPLATE_STORAGE_KEY = "sonect.theme.template";

export function isThemeTemplate(value: unknown): value is ThemeTemplate {
  return THEME_TEMPLATES.some((template) => template.id === value);
}
