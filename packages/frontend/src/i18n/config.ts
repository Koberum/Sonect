import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";

export const SUPPORTED_LANGUAGES = ["en", "es", "it"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export function normalizeLanguage(
  language: string | null | undefined,
): SupportedLanguage {
  const base = language?.split("-")[0] ?? "";
  return SUPPORTED_LANGUAGES.includes(base as SupportedLanguage)
    ? (base as SupportedLanguage)
    : "en";
}

const savedLanguage =
  typeof localStorage === "undefined" ? null : localStorage.getItem("language");
const browserLanguage =
  typeof navigator === "undefined" ? "en" : navigator.language;
const defaultLanguage = normalizeLanguage(savedLanguage ?? browserLanguage);

i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend(
      (language: string) => import(`./locales/${language}.json`),
    ),
  )
  .init({
    lng: defaultLanguage,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

i18n.on("languageChanged", (language) => {
  const normalized = normalizeLanguage(language);
  if (typeof document !== "undefined") {
    document.documentElement.lang = normalized;
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("language", normalized);
  }
});

if (typeof document !== "undefined") {
  document.documentElement.lang = defaultLanguage;
}

export default i18n;
