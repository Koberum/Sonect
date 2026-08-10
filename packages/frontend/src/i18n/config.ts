import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import resourcesToBackend from "i18next-resources-to-backend";

// Get the user's preferred language from localStorage or browser settings
const savedLanguage = localStorage.getItem("language");
const browserLanguage = navigator.language.split("-")[0];
const defaultLanguage = savedLanguage || browserLanguage || "en";

i18n
  .use(initReactI18next)
  .use(
    resourcesToBackend(
      (language: string) =>
        import(`./locales/${language}.json`),
    ),
  )
  .init({
    lng: defaultLanguage,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
